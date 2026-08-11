#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = readJson('package.json');
const grammarContribution = manifest.contributes.grammars[0];
const grammarPath = grammarContribution.path.replace(/^\.\//, '');
const grammar = readJson(grammarPath);

assert.equal(
  grammar.scopeName,
  grammarContribution.scopeName,
  'Grammar scopeName must match package.json'
);
assert.ok(
  fs.existsSync(path.join(root, manifest.contributes.languages[0].configuration)),
  'Language configuration referenced by package.json must exist'
);

const includes = grammar.patterns.map(({ include }) => include);
assert.equal(new Set(includes).size, includes.length, 'Top-level includes must be unique');

for (const include of includes) {
  assert.ok(include.startsWith('#'), `Local include expected: ${include}`);
  assert.ok(grammar.repository[include.slice(1)], `Missing repository entry: ${include}`);
}

const opcodeOwners = new Map();
for (const { name, match } of grammar.repository.instructions.patterns) {
  const alternatives = extractAlternatives(match, name);
  assert.equal(
    new Set(alternatives).size,
    alternatives.length,
    `${name} contains a duplicate opcode`
  );

  for (const opcode of alternatives) {
    const owner = opcodeOwners.get(opcode);
    assert.ok(!owner, `${opcode} is defined by both ${owner} and ${name}`);
    opcodeOwners.set(opcode, name);
  }
}

console.log(
  `Validated ${opcodeOwners.size} opcodes across ${opcodeOwners.size ? grammar.repository.instructions.patterns.length : 0} categories.`
);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function extractAlternatives(pattern, name) {
  const start = pattern.lastIndexOf(')(');
  const end = pattern.lastIndexOf(')\\b');
  assert.ok(start >= 0 && end > start, `${name} must end in an opcode alternation`);
  return pattern.slice(start + 2, end).split('|');
}
