# MdBridge — agent development guide

## Acceptance criteria

Before claiming work is complete:

```bash
npm test
npm run compile
```

Both commands must exit successfully.

## Bug-fix workflow

1. Reproduce the bug with a failing test under `test/`.
2. Fix `src/`.
3. Confirm `npm test` passes.

Prefer unit tests in `test/unit/` for parser and utility logic. Use `test/converters/` with fixtures for end-to-end converter behavior.

## Test layout

| Path | Purpose |
| --- | --- |
| `test/unit/` | Pure functions (`markdownBlocks`, `fileHelpers`, `clipboardRichText`) |
| `test/converters/` | Converter golden / structural tests |
| `test/helpers/` | Fixture loaders, minimal OOXML/ODF builders |
| `sample/md-bridge_sample.md` | Canonical Markdown input for MD→DOCX/HTML tests |

## Fixtures

- Keep binary fixtures minimal and synthetic (programmatic builders in `test/helpers/`).
- Do not commit large `.msg`, `.docx`, or `.pptx` files.
- Normalize line endings to `\n` when loading text fixtures on Windows.

## Out of scope for automated tests

- VS Code command registration and UI (`extension.ts`) — verify manually via F5 Extension Development Host
- OS clipboard integration (`copyRichTextToClipboard`) — `buildCfHtml` is unit-tested instead

## Regression tests

When fixing a user-reported bug, add a `describe('regression: ...')` block with a one-line comment describing the symptom prevented.
