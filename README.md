# SASS Assembly

Syntax highlighting for NVIDIA GPU SASS assembly in VS Code and Cursor.
The extension associates `.sass` files with the `sass-assembly` language.

## Features

- Instruction highlighting with separate scopes for arithmetic, bitwise,
  comparison, control, conversion, memory, movement, matrix, texture, uniform,
  synchronization, collective, and miscellaneous operations.
- Dotted instruction modifiers such as `LDG.E.SYS` and `HMMA.1688.F32`.
- General, uniform, predicate, uniform predicate, barrier, and special registers.
- Hexadecimal, signed integer, decimal, and scientific-notation constants.
- ELF directives, labels, quoted metadata, and line and block comments.
- Bracket matching and automatic closing of brackets and quotes.

```sass-assembly
.section .text.example,"ax",@progbits
example:
    /*0000*/ S2R R0, SR_CTAID.Y;
    /*0010*/ @!P0 LDG.E.SYS R2, [R4];
    /*0020*/ FADD.FTZ R3, R2, -3.5e-2;
    /*0030*/ HMMA.1688.F32 R4, R8, R12, R4;
    /*0040*/ EXIT;
```

## Installation

Use VS Code 1.74 or later, or a compatible Cursor version. A CUDA toolkit or
GPU is not required to highlight an existing disassembly file.

1. Obtain the VSIX by building this repository or downloading a CI artifact.
2. Open the Command Palette with `Cmd+Shift+P` on macOS or `Ctrl+Shift+P` on
   Windows and Linux.
3. Choose **Extensions: Install from VSIX…** and select `sass-0.0.2.vsix`.
4. Open a `.sass` file. The language indicator should show **SASS Assembly**.

Alternatively, run `code --install-extension sass-0.0.2.vsix` or
`cursor --install-extension sass-0.0.2.vsix` with the editor's CLI on your PATH.

## File associations

This extension contributes a default association of `*.sass` with
`sass-assembly`. For a workspace using indented CSS Sass, override it in
`.vscode/settings.json`:

```json
{
  "files.associations": {
    "*.sass": "sass"
  }
}
```

To highlight assembly files using another extension, associate that pattern with
`sass-assembly`. The extension adds no custom settings.

## Build and development

Install Node.js 22 or later and npm on macOS, Windows, or Linux. Node.js 24 is
used by CI. Packaging and test dependencies are local and pinned in
`package-lock.json`; no global `vsce` installation is required.

```sh
npm ci
npm test
npm run package
```

`npm run package` runs validation and tokenization tests, then creates
`sass-0.0.2.vsix`. On macOS and Linux, `./package.sh` is also available after
`npm ci`; Windows users can run the npm commands directly.

Open the repository in VS Code and press `F5` to launch an Extension Development
Host. Open `tests/fixtures/sample.sass` to inspect the grammar with your theme.
Run **Developer: Inspect Editor Tokens and Scopes** to examine individual tokens.

`npm run check` validates manifest references, language configuration, opcode
uniqueness, and every grammar regex using Oniguruma. `npm test` also exercises
the VS Code TextMate tokenizer against the opcode corpus and representative
disassembly, checking modifiers, boundaries, literals, comments, and metadata.
GitHub Actions runs packaging on Linux, Windows, and macOS and uploads VSIX files.

## Coverage and limitations

The opcode corpus covers the instruction tables for Maxwell/Pascal, Volta,
Turing, Ampere/Ada, Hopper, and Blackwell in
[NVIDIA's CUDA 12.9.1 Binary Utilities reference](https://docs.nvidia.com/cuda/archive/12.9.1/cuda-binary-utilities/index.html#instruction-set-reference),
plus previously supported spellings. `tests/fixtures/opcodes.json` records the
reference and coverage list. This is syntax highlighting, not an assembler or
an architecture-specific instruction validator: accepting an opcode does not
mean it is available on every GPU. Undocumented instructions and future
architecture additions may need grammar updates.

Special register names beginning with `SR_` are highlighted generically.
Instruction modifiers are highlighted without validating their meaning.
Quoted strings support double quotes; PTX highlighting, completion, diagnostics,
debugging, and disassembly generation are outside this extension's scope.

## Releases

See [CHANGELOG.md](CHANGELOG.md). The manifest uses publisher `local-dev` for
local VSIX installation. Marketplace publication requires an owned publisher
ID and its authentication credentials.
