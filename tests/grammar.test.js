'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, test } = require('node:test');
const { Registry, parseRawGrammar } = require('vscode-textmate');
const { loadWASM, OnigScanner, OnigString } = require('vscode-oniguruma');
const root = path.resolve(__dirname, '..');
let grammar;

before(async () => {
  await loadWASM(fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer);
  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner: patterns => new OnigScanner(patterns),
      createOnigString: text => new OnigString(text)
    }),
    loadGrammar: async () => parseRawGrammar(
      fs.readFileSync(path.join(root, 'syntaxes/sass.tmLanguage.json'), 'utf8'), 'sass.tmLanguage.json')
  });
  grammar = await registry.loadGrammar('source.sass.assembly');
});

function tokens(line, state) {
  const result = grammar.tokenizeLine(line, state);
  return { state: result.ruleStack, tokens: result.tokens.map(token => ({
    text: line.slice(token.startIndex, token.endIndex), scopes: token.scopes
  })) };
}

function expectToken(line, text, scope) {
  const found = tokens(line).tokens.find(token => token.text === text && token.scopes.includes(scope));
  assert.ok(found, `${JSON.stringify(text)} should have ${scope} in ${line}`);
}

test('reference opcode corpus is recognized, including case and suffixes', () => {
  const { opcodes } = require('./fixtures/opcodes.json');
  for (const opcode of opcodes) {
    for (const spelling of [opcode, opcode.toLowerCase()]) {
      const result = tokens(`/*0010*/ @!P0 ${spelling}.E.32 R0, RZ;`).tokens;
      assert.ok(result.some(token => token.text === spelling && token.scopes.some(scope => scope.startsWith('keyword.instruction.'))), opcode);
      assert.ok(result.some(token => token.text === '.E.32' && token.scopes.includes('storage.modifier.sass')), opcode);
    }
  }
});

test('predicates, uniform registers, and special register components', () => {
  for (const operand of ['UP0', 'UPT']) expectToken(`@!${operand} BRA 0x20;`, operand, 'entity.name.class.register.predicate.uniform.sass');
  for (const operand of ['SR_CTAID.Y', 'SR_CTAID.Z', 'SR_TID.X', 'SR_CLOCKLO']) expectToken(`S2R R0, ${operand};`, operand, 'entity.name.class.register.special.sass');
  expectToken('UMOV UR12, URZ;', 'UR12', 'entity.name.class.register.uniform.sass');
  expectToken('@P0 MOV R255, RZ;', 'P0', 'entity.name.class.register.predicate.sass');
});

test('numeric literals are highlighted in full', () => {
  for (const literal of ['3.5', '-0.5', '.25', '1.', '1e-3', '-2.5E+4']) expectToken(`FADD R0, R1, ${literal};`, literal, 'constant.numeric.float.sass');
  for (const literal of ['0xAB', '-0Xff']) expectToken(`MOV R0, ${literal};`, literal, 'constant.numeric.hex.sass');
  for (const literal of ['42', '-7']) expectToken(`MOV R0, ${literal};`, literal, 'constant.numeric.decimal.sass');
});

test('symbol boundaries prevent false opcode, register, and constant matches', () => {
  const result = tokens('unknown_LDG R1foo foo.R2 .LDG foo123 0xZZ;').tokens;
  assert.ok(result.every(token => !token.scopes.some(scope => /keyword\.instruction|register|constant\.numeric/.test(scope))));
});

test('comments suppress code scopes and block comments carry state', () => {
  expectToken('// LDG R0, 3.5;', '// LDG R0, 3.5;', 'comment.line.double-slash.sass');
  const first = tokens('/* LDG R0');
  const second = tokens('HMMA R1 */ MOV R2, 0x4;', first.state);
  assert.ok(second.tokens.filter(token => token.text.includes('HMMA')).every(token => token.scopes.includes('comment.block.sass')));
  assert.ok(second.tokens.some(token => token.text === 'MOV' && token.scopes.includes('keyword.instruction.movement.sass')));
});

test('directives, labels, and quoted metadata', () => {
  expectToken('.sectioninfo @"SHI_REGISTERS=14"', '.sectioninfo', 'keyword.directive.sass');
  expectToken('kernel_name:', 'kernel_name:', 'entity.name.label.sass');
  expectToken('MOV:', 'MOV:', 'entity.name.label.sass');
  expectToken('BRA `(.L_21);', '.L_21', 'entity.name.label.sass');
  const result = tokens('.section .text.foo,"LDG R0",@progbits').tokens;
  assert.ok(result.filter(token => token.text.includes('LDG')).every(token => token.scopes.includes('string.quoted.double.sass')));
});

test('representative disassembly fixture tokenizes across lines', () => {
  let state;
  const scopes = new Set();
  for (const line of fs.readFileSync(path.join(__dirname, 'fixtures/sample.sass'), 'utf8').split('\n')) {
    const result = tokens(line, state);
    state = result.state;
    for (const token of result.tokens) for (const scope of token.scopes) scopes.add(scope);
  }
  for (const scope of ['keyword.instruction.matrix.sass', 'keyword.instruction.memory.sass', 'constant.numeric.float.sass', 'entity.name.label.sass']) assert.ok(scopes.has(scope), scope);
});
