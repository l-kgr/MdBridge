# MdBridge

[![License](https://img.shields.io/github/license/l-kgr/MdBridge)](LICENSE)
[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fl-kgr%2FMdBridge%2Fmain%2Fpackage.json&query=%24.version&label=version)](https://github.com/l-kgr/MdBridge/blob/main/package.json)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![Cursor](https://img.shields.io/badge/Cursor-compatible-000000?logo=cursor&logoColor=white)](https://cursor.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![GitHub](https://img.shields.io/badge/GitHub-l--kgr%2FMdBridge-181717?logo=github)](https://github.com/l-kgr/MdBridge)

VS Code / Cursor extension for document conversion workflows.

Convert Outlook messages, Word documents, and PowerPoint decks to Markdown, and export Markdown back to DOCX. Commands are available from the Explorer context menu.

## Why MdBridge?

This workflow comes up often — turning Outlook messages, Word docs, and decks into Markdown (and sometimes back to DOCX) — but existing tools were either awkward to fit into a daily editor workflow or did not match what I needed. MdBridge is a small, self-contained extension that does exactly that from the Explorer context menu, without leaving VS Code or Cursor.

Parts of the plugin were developed with AI assistance (pair-programming and code generation). The project is open source so others with the same workflow can use or adapt it.

## Features

| Command | Input | Output |
| --- | --- | --- |
| MdBridge: Convert MSG → Markdown | `.msg` | `.md` with YAML frontmatter (from, to, subject, date, attachments) |
| MdBridge: Convert DOCX → Markdown | `.docx` | `.md` |
| MdBridge: Convert DOCX → Markdown (with comments) | `.docx` | `.md` with inline comment annotations |
| MdBridge: Export Markdown → DOCX | `.md` | `.docx` |
| MdBridge: Convert PPTX → Markdown | `.pptx` | `.md` (slide text) |

Output files are written next to the source file. If a file with the same name already exists, MdBridge appends `_1`, `_2`, and so on.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- [VS Code](https://code.visualstudio.com/) 1.85+ or [Cursor](https://cursor.com/) (VS Code extension compatible)

## Installation

Build a `.vsix` locally (see [Build from source](#build-from-source)), then install it:

- **VS Code / Cursor UI:** Extensions panel → `...` → **Install from VSIX...**
- **CLI:** `code --install-extension mdbridge-0.0.1.vsix` or `cursor --install-extension mdbridge-0.0.1.vsix`

Extension ID: `l-kgr.mdbridge`

## Build from source

Clone this repository, then from the project root:

```bash
# 1. Install dependencies
npm install

# 2. Compile TypeScript → dist/extension.js (webpack)
npm run compile
```

| Script | Purpose |
| --- | --- |
| `npm run compile` | One-off production bundle to `dist/` |
| `npm run watch` | Rebuild `dist/` when `src/` changes |
| `npm run package` | Production bundle with hidden source maps (used by `vsce package`) |

### Create a VSIX installer

```bash
npm run compile
npx @vscode/vsce package
# → mdbridge-0.0.1.vsix in the project root (gitignored)
```

Install the generated file via the UI or CLI (see [Installation](#installation)).

> `vsce` is not a project dependency. `npx @vscode/vsce` downloads it on first use, or install globally: `npm install -g @vscode/vsce`.

## Development mode (F5)

Use this to run and debug the extension without packaging a VSIX. MdBridge does not show in the Extensions panel until you launch via F5 or install a `.vsix`.

### One-time setup

1. Open this folder as the VS Code / Cursor workspace root.
2. Run `npm install` and `npm run compile`.

### Launch Extension Development Host

1. Open **Run and Debug** (`Ctrl+Shift+D` / `Cmd+Shift+D`).
2. Select **Run Extension** from the dropdown.
3. Press **F5** (or **Start Debugging**).

A second editor window opens (**Extension Development Host**). MdBridge is loaded only in that window.

### Test conversions

1. In the Extension Development Host window, **File → Open Folder** and pick a directory with `.msg`, `.docx`, `.pptx`, or `.md` files.
2. Right-click a file in Explorer → choose an **MdBridge:** command, or use the Command Palette (`Ctrl+Shift+P`) and search for `MdBridge`.

### Iterating on code

**Option A — compile before each run**

```bash
npm run compile
```

Press **F5** again (or reload the Extension Development Host with `Ctrl+R` / `Cmd+R` after recompiling).

**Option B — watch mode (recommended)**

In a terminal at the project root:

```bash
npm run watch
```

After saving changes under `src/`, wait for webpack to finish, then reload the Extension Development Host (`Ctrl+R` / `Cmd+R`).

The **Run Extension** launch config runs the `mdbridge: compile` task automatically before F5, so a fresh `npm run compile` is not required on every debug start unless you skipped the preLaunch task.

### Debugging

- Set breakpoints in `src/*.ts`; they map to the bundled `dist/extension.js` via source maps.
- Extension logs appear in the **original** window: **View → Output**, then choose the extension host channel from the dropdown.

## Usage

1. Open a workspace folder in VS Code or Cursor.
2. In the Explorer, right-click a supported file (`.msg`, `.docx`, `.pptx`, or `.md`).
3. Choose the matching MdBridge command.

You can also open the Command Palette (`Ctrl+Shift+P`) and search for `MdBridge`.

After conversion, Markdown results open in the editor. DOCX exports show a confirmation with the output path.

## Project layout

```
src/
  extension.ts          # command registration
  converters/           # msg, docx, pptx, md converters
  utils/                # shared file helpers
dist/extension.js       # bundled output (generated, gitignored)
.vscode/                # launch and task config for F5 debugging
```

## Conversion fidelity

| Conversion | Notes |
| --- | --- |
| MSG → MD | HTML body preferred; plain text fallback; metadata in frontmatter |
| DOCX → MD | High fidelity via [mammoth](https://github.com/mwilliamson/mammoth.js) |
| DOCX → MD (comments) | Body text plus Word comment metadata (author, date) inline in Markdown |
| MD → DOCX | Headings, bold, italic; complex Markdown may need pandoc for full fidelity |
| PPTX → MD | Slide text extraction; speaker notes not included |

## Third-party dependencies

MdBridge bundles several open-source libraries (see `package.json`). Their licenses apply to those components. This project is licensed under the [MIT License](./LICENSE).

## Contributing

Contributions are welcome — issues and pull requests at [github.com/l-kgr/MdBridge](https://github.com/l-kgr/MdBridge). Run `npm run compile` before submitting changes.

That said, MdBridge is intentionally a small, focused tool built for a personal workflow. Whether it will be actively developed further is **TBD**; there is no roadmap or release schedule. Feel free to fork if you need something more maintained or feature-rich.

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE) — Copyright (c) 2026 l-kgr
