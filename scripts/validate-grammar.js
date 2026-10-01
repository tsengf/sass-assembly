#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jsonc = require('jsonc-parser');
const { loadWASM, OnigScanner } = require('vscode-oniguruma');

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
const configurationErrors = [];
jsonc.parse(fs.readFileSync(path.join(root, manifest.contributes.languages[0].configuration), 'utf8'), configurationErrors);
assert.deepEqual(configurationErrors, [], 'Language configuration must be valid JSONC');
assert.equal(grammarContribution.language, manifest.contributes.languages[0].id);

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

async function validateRegexes() {
  await loadWASM(fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer);
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['match', 'begin', 'end', 'while'].includes(key) && typeof child === 'string') {
        const scanner = new OnigScanner([child]);
        scanner.dispose();
      } else visit(child);
    }
  }
  visit(grammar);
  console.log(`Validated ${opcodeOwners.size} opcodes, configuration, and Oniguruma regexes.`);
}
validateRegexes().catch(error => { console.error(error); process.exitCode = 1; });

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function extractAlternatives(pattern, name) {
  const start = pattern.lastIndexOf(')(');
  const end = pattern.lastIndexOf(')\\b');
  assert.ok(start >= 0 && end > start, `${name} must end in an opcode alternation`);
  return pattern.slice(start + 2, end).split('|');
}
