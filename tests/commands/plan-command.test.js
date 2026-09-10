'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const planCommandPath = path.join(repoRoot, 'commands', 'plan.md');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

function readPlanCommand() {
  return fs.readFileSync(planCommandPath, 'utf8');
}

console.log('\n=== Testing /plan command prompt ===\n');

test('/plan is a thin entry over the writing-plans skill', () => {
  const source = readPlanCommand();

  assert.ok(
    source.includes('Thin entry over the `writing-plans` skill'),
    'Expected /plan to defer to the writing-plans skill',
  );
  assert.ok(
    source.includes('**Input**: `$ARGUMENTS`'),
    'Expected /plan to forward its arguments',
  );
  assert.ok(
    !source.includes('This command invokes the **planner** agent'),
    'Expected /plan not to claim unconditional planner invocation',
  );
});

test('/plan keeps the no-code and no-PRD gates', () => {
  const source = readPlanCommand();

  assert.ok(
    source.includes('WAIT for confirmation before code'),
    'Expected frontmatter to preserve the no-code-before-confirmation rule',
  );
  assert.ok(
    source.includes('Do not write a PRD. Do not write code.'),
    'Expected the body to forbid PRDs and code',
  );
  assert.ok(
    source.includes('Save to `.claude/plans/<stem>.md`'),
    'Expected the plan drop path to stay fixed',
  );
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);

process.exit(failed > 0 ? 1 : 0);
