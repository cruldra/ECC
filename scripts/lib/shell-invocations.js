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
const WRAPPER_COMMANDS = new Set([
  'env',
  'sudo',
  'doas',
  'nohup',
  'time',
  'command',
  'builtin',
  'exec',
  'nice',
  'ionice',
  'stdbuf',
  'xargs',
]);

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
 * Read a command substitution body starting at `start`.
 * `closer` is ')' for `$(...)` (nesting allowed) or '`' for backticks.
 */
function readSubstitution(input, start, closer) {
  let depth = 0;
  let quote = null;

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

    // Comment: everything to end of line is text, not a command.
    if (char === '#' && (i === 0 || /\s/.test(command.charAt(i - 1)))) {
      const newline = command.indexOf('\n', i);
      i = newline === -1 ? command.length : newline;
      continue;
    }

    if (char === ';' || char === '|' || char === '&' || char === '\n'
      || char === '(' || char === ')' || char === '{' || char === '}') {
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
const GIT_GLOBAL_FLAGS_WITH_VALUE = new Set([
  '-c',
  '-C',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--exec-path',
  '--config-env',
]);

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
  SHELL_COMMANDS,
};
