'use strict';

/**
 * Shell command parsing for hooks that must reason about which programs a
 * Bash command actually runs.
 *
 * Substring matching on the raw command line cannot tell an invocation from
 * text: `grep -rn "git commit" vendor/` runs grep, not git. Hooks that match
 * on the raw string treat the search pattern as a commit and prompt the user
 * for a read-only command.
 *
 * `parseInvocations()` splits the command into the programs it launches —
 * across operators, command substitutions, and `sh -c` payloads — so hooks
 * can key on the program name and its arguments instead of on text that
 * merely appears somewhere in the line.
 */

// Programs that run another program passed as their arguments. The real
// invocation is what follows, so parsing steps past them.
const WRAPPER_COMMANDS = new Set(['env', 'sudo', 'doas', 'nohup', 'time', 'command', 'builtin', 'exec', 'nice', 'ionice', 'stdbuf', 'xargs']);

// Shells whose `-c` argument is a script to parse in turn.
const SHELL_COMMANDS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);

// Guards against pathological nesting of substitutions and `sh -c` payloads.
const MAX_PARSE_DEPTH = 5;

/**
 * Split shell text into words, honouring quotes and backslash escapes.
 * Returns the unquoted value of each word plus its span in the input, so
 * callers can scope further scanning to a token range.
 */
function tokenizeShellWords(input, start = 0, end = input.length) {
  const tokens = [];
  let value = '';
  let tokenStart = null;
  let quote = null;
  let escaped = false;

  function beginToken(index) {
    if (tokenStart === null) {
      tokenStart = index;
    }
  }

  function pushToken(index) {
    if (tokenStart === null) {
      return;
    }

    tokens.push({ value, start: tokenStart, end: index });
    value = '';
    tokenStart = null;
  }

  for (let i = start; i < end; i++) {
    const char = input.charAt(i);

    if (escaped) {
      beginToken(i - 1);
      value += char;
      escaped = false;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }

      if (quote === '"' && char === '\\') {
        beginToken(i);
        escaped = true;
        continue;
      }

      beginToken(i);
      value += char;
      continue;
    }

    if (char === '"' || char === "'") {
      beginToken(i);
      quote = char;
      continue;
    }

    if (char === '\\') {
      beginToken(i);
      escaped = true;
      continue;
    }

    if (/\s/.test(char)) {
      pushToken(i);
      continue;
    }

    beginToken(i);
    value += char;
  }

  if (escaped) {
    value += '\\';
  }
  pushToken(end);

  return tokens;
}

/**
 * Read the delimiter of a here-document redirect `<<WORD` / `<<-WORD` starting
 * at `start` (the first `<`). Quotes around the word are removed. Returns null
 * for a here-string `<<<` or when no word follows.
 */
function readHeredocDelimiter(input, start) {
  if (input.charAt(start + 2) === '<') return null;
  let i = start + 2;
  const stripTabs = input.charAt(i) === '-';
  if (stripTabs) i++;
  while (input.charAt(i) === ' ' || input.charAt(i) === '\t') i++;

  let delimiter = '';
  while (i < input.length && !/[\s;|&<>()]/.test(input.charAt(i))) {
    const char = input.charAt(i);
    if (char === "'" || char === '"') {
      const close = input.indexOf(char, i + 1);
      const stop = close === -1 ? input.length : close;
      delimiter += input.slice(i + 1, stop);
      i = stop + 1;
    } else if (char === '\\') {
      delimiter += input.charAt(i + 1);
      i += 2;
    } else {
      delimiter += char;
      i++;
    }
  }

  return delimiter ? { delimiter, stripTabs, end: Math.min(i, input.length) } : null;
}

/**
 * Skip the bodies of pending here-documents, which start at `start` (just
 * after the newline that ends the redirecting line). Returns the index after
 * the last delimiter line.
 */
function skipHeredocBodies(input, start, pending) {
  let i = start;
  for (const { delimiter, stripTabs } of pending) {
    while (i < input.length) {
      const newline = input.indexOf('\n', i);
      const lineEnd = newline === -1 ? input.length : newline;
      const line = input.slice(i, lineEnd);
      i = lineEnd + 1;
      if ((stripTabs ? line.replace(/^\t+/, '') : line) === delimiter) break;
    }
  }
  return Math.min(i, input.length);
}

/**
 * Read a command substitution body starting at `start`.
 * `closer` is ')' for `$(...)` (nesting allowed) or '`' for backticks.
 */
function readSubstitution(input, start, closer) {
  let depth = 0;
  let quote = null;
  let heredocs = [];

  for (let i = start; i < input.length; i++) {
    const char = input.charAt(i);

    if (char === '\\') {
      i++;
      continue;
    }

    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (input.startsWith('<<<', i)) {
      i += 2;
      continue;
    }

    if (char === '<' && input.charAt(i + 1) === '<') {
      const heredoc = readHeredocDelimiter(input, i);
      if (heredoc) {
        heredocs.push(heredoc);
        i = heredoc.end - 1;
        continue;
      }
    }

    if (char === '\n' && heredocs.length) {
      i = skipHeredocBodies(input, i + 1, heredocs) - 1;
      heredocs = [];
      continue;
    }

    if (closer === ')') {
      if (char === '(') {
        depth++;
        continue;
      }
      if (char === ')') {
        depth--;
        if (depth === 0) {
          return { body: input.slice(start + 1, i), end: i + 1 };
        }
      }
      continue;
    }

    if (char === '`' && i > start) {
      return { body: input.slice(start + 1, i), end: i + 1 };
    }
  }

  return { body: input.slice(start + 1), end: input.length };
}

/**
 * Split a command line into simple-command segments, collecting the bodies of
 * command substitutions separately. Quotes and escapes suppress operators, so
 * an operator inside a quoted argument never starts a new segment.
 */
function scanSegments(command) {
  const segments = [];
  const substitutions = [];
  let current = '';
  let quote = null;
  let heredocs = [];
  let i = 0;

  function flush() {
    const trimmed = current.trim();
    if (trimmed) segments.push(trimmed);
    current = '';
  }

  while (i < command.length) {
    const char = command.charAt(i);
    const next = command.charAt(i + 1);

    if (char === '\\') {
      current += char + next;
      i += 2;
      continue;
    }

    if (quote === "'") {
      current += char;
      if (char === "'") quote = null;
      i++;
      continue;
    }

    // Command substitution runs even inside double quotes.
    if (quote !== "'" && char === '$' && next === '(') {
      const read = readSubstitution(command, i + 1, ')');
      substitutions.push(read.body);
      current += ' ';
      i = read.end;
      continue;
    }

    if (quote !== "'" && char === '`') {
      const read = readSubstitution(command, i, '`');
      substitutions.push(read.body);
      current += ' ';
      i = read.end;
      continue;
    }

    if (quote === '"') {
      current += char;
      if (char === '"') quote = null;
      i++;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      i++;
      continue;
    }

    if (command.startsWith('<<<', i)) {
      current += '<<<';
      i += 3;
      continue;
    }

    // Here-document: its body lines are input text, not commands.
    if (char === '<' && next === '<') {
      const heredoc = readHeredocDelimiter(command, i);
      if (heredoc) {
        heredocs.push(heredoc);
        current += command.slice(i, heredoc.end);
        i = heredoc.end;
        continue;
      }
    }

    if (char === '\n' && heredocs.length) {
      flush();
      i = skipHeredocBodies(command, i + 1, heredocs);
      heredocs = [];
      continue;
    }

    // Comment: everything to end of line is text, not a command.
    if (char === '#' && (i === 0 || /\s/.test(command.charAt(i - 1)))) {
      const newline = command.indexOf('\n', i);
      i = newline === -1 ? command.length : newline;
      continue;
    }

    if (char === ';' || char === '|' || char === '&' || char === '\n' || char === '(' || char === ')' || char === '{' || char === '}') {
      flush();
      i++;
      continue;
    }

    current += char;
    i++;
  }

  flush();
  return { segments, substitutions };
}

/**
 * Reduce a token to the program name: strip any directory prefix and the
 * Windows `.exe` suffix so `/usr/bin/git` and `git.exe` both read as `git`.
 */
function commandName(token) {
  const base = token.split('/').pop().split('\\').pop();
  return base.toLowerCase().endsWith('.exe') ? base.slice(0, -4) : base;
}

function isEnvAssignment(token) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function isRedirection(token) {
  return /^\d*[<>]/.test(token);
}

/** A bare redirection operator takes its target from the next token. */
function isBareRedirection(token) {
  return /^\d*(?:<|>|>>|<<|<<<|<>)$/.test(token);
}

/**
 * Turn one segment into `{ name, args }`, stepping past leading environment
 * assignments, redirections, and wrapper programs.
 */
function invocationFromSegment(segment) {
  const tokens = tokenizeShellWords(segment)
    .map(token => token.value)
    .filter(value => value !== '');

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (isEnvAssignment(token)) {
      i++;
      continue;
    }

    if (isRedirection(token)) {
      i += isBareRedirection(token) ? 2 : 1;
      continue;
    }

    const name = commandName(token);

    if (WRAPPER_COMMANDS.has(name)) {
      i++;
      while (i < tokens.length && (tokens[i].startsWith('-') || isEnvAssignment(tokens[i]))) {
        i++;
      }
      continue;
    }

    return { name, args: tokens.slice(i + 1) };
  }

  return null;
}

/**
 * Parse a Bash command into the invocations it performs.
 *
 * Each entry is `{ name, args }` where `name` is the program name without
 * path or `.exe`, and `args` are its unquoted arguments. Invocations inside
 * command substitutions and `sh -c` payloads are included.
 */
function parseInvocations(command, depth = 0) {
  const text = String(command || '');
  if (!text.trim() || depth > MAX_PARSE_DEPTH) return [];

  const { segments, substitutions } = scanSegments(text);
  const invocations = [];

  for (const segment of segments) {
    const invocation = invocationFromSegment(segment);
    if (!invocation) continue;

    invocations.push(invocation);

    if (SHELL_COMMANDS.has(invocation.name)) {
      const flagIndex = invocation.args.indexOf('-c');
      const script = flagIndex === -1 ? null : invocation.args[flagIndex + 1];
      if (script) {
        invocations.push(...parseInvocations(script, depth + 1));
      }
    }
  }

  for (const body of substitutions) {
    invocations.push(...parseInvocations(body, depth + 1));
  }

  return invocations;
}

/** Invocations of a given program, e.g. `findInvocations(cmd, 'git')`. */
function findInvocations(command, name) {
  return parseInvocations(command).filter(invocation => invocation.name === name);
}

// Git global flags that consume the following token as their value; the
// subcommand is the first bare word that is not one of those values.
const GIT_GLOBAL_FLAGS_WITH_VALUE = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--exec-path', '--config-env']);

/**
 * Split `git` arguments into its subcommand and that subcommand's arguments.
 * Returns null when no subcommand is present (`git --version`).
 */
function gitSubcommand(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (GIT_GLOBAL_FLAGS_WITH_VALUE.has(arg)) {
      i++;
      continue;
    }

    if (arg.startsWith('-')) continue;

    return { name: arg, args: args.slice(i + 1) };
  }

  return null;
}

/** Git subcommands invoked by a command line, as `{ name, args }`. */
function gitSubcommands(command) {
  return findInvocations(command, 'git')
    .map(invocation => gitSubcommand(invocation.args))
    .filter(Boolean);
}

module.exports = {
  tokenizeShellWords,
  parseInvocations,
  findInvocations,
  gitSubcommand,
  gitSubcommands,
  commandName,
  WRAPPER_COMMANDS,
  SHELL_COMMANDS
};
