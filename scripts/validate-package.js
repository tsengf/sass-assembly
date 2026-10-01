#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const cli = path.join(path.dirname(require.resolve('@vscode/vsce/package.json')), 'vsce');
const files = execFileSync(process.execPath, [cli, 'ls', '--no-dependencies'], {
  cwd: root, encoding: 'utf8'
}).trim().split(/\r?\n/).map(file => file.replace(/\\/g, '/')).sort();
assert.deepEqual(files, [
  'CHANGELOG.md', 'LICENSE.md', 'README.md', 'language-configuration.json',
  'package.json', 'syntaxes/sass.tmLanguage.json'
].sort(), 'VSIX must contain only runtime files and release documentation');
console.log(`Validated ${files.length} extension package files.`);
