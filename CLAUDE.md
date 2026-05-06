# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test           # Run Jest test suite
npm run test:watch # Watch mode for development
npm run build:msal # Rebuild the vendored MSAL bundle (only needed after updating @azure/msal-browser)
```

No build step required for the app itself — serve `index.html` directly (e.g. via VS Code Live Server at `http://localhost:5500`).

## Architecture

This is a **vanilla JS single-page PWA** — no framework, no bundler. All application code lives in one `<script>` block inside `index.html` (~2700 lines). `styles.css` holds all styling. Third-party libs are vendored in `vendor/`.

### Data flow

```
User input (contenteditable / form fields)
  → persist() / saveRoundField() / collectThoughtsFromDom()
  → Store.upsert(analysis)       ← localStorage JSON
  → autoSyncDebounced()          ← optional OneDrive push
  → render()                     ← full DOM replacement
```

### Key modules (all inline in index.html)

| Section | Responsibility |
|---|---|
| `Store` | localStorage wrapper, tombstone-based deletion for sync |
| `Crypto` | PBKDF2 key derivation + AES-GCM encrypt/decrypt |
| `Sync` | MSAL v5 OAuth + Microsoft Graph (OneDrive upload/download) + three-way merge |
| `State` | Single global UI state object (`view`, `step`, `roundIdx`, `roundStep`, `current`) |
| `render()` | Dispatcher → `renderHome` / `renderWizard` / `renderDetail` |
| `renderSituationStep()` | Wizard steps 0–3 (datetime, mood, need, context) |
| `renderRoundStep()` | IP/my behavior, interpretation, thoughts, tension, need, desired effect |
| `renderDetail()` | Read-only view; uses `renderRichField()` for formatted fields |
| `buildTextExport()` / `_buildPdf()` | Export; use `richHtmlToText()` to strip formatting |

### Rich text fields

Narrative `<textarea>` fields were replaced with `contenteditable` divs + a 4-button toolbar (F/K/U/•). Key functions:

- `richEditorHTML(id, value, placeholder)` — renders the toolbar + editor widget
- `sanitizeRichText(html)` — allowlist sanitizer (keeps `<strong>`, `<em>`, `<u>`, `<ul>`, `<li>`, `<br>`, `<p>`)
- `getRichValue(id)` — reads sanitized HTML from a contenteditable (falls back to `.value` for plain inputs)
- `renderRichField(value)` — safe rendering in detail view (escapes plain text, sanitizes HTML)
- `richHtmlToText(html)` — strips HTML for text/PDF export

Old plain-text data in localStorage renders correctly without migration.

### Data model

```js
{
  id: 'a_<timestamp>',
  situation: { title, datetime, mood, need, context, contextWhat, contextWho, contextWhere },
  rounds: [{
    id: 'r_<timestamp>',
    starter: 'me' | 'ip',
    ipBehaviorVerbal, ipBehaviorNonverbal, ipBehavior,  // ipBehavior = legacy combined
    interpretation, thoughts: [{ id, text, feelings[] }],
    standaloneFeelings[], tension,
    need, myBehaviorVerbal, myBehaviorNonverbal, myBehavior, desiredEffect
  }]
}
```

IDs are prefixed: `a_` = analysis, `r_` = round, `t_` = thought. `migrateRound()` handles backwards compatibility.

### Testing

Tests live in `tests/`. The test helper (`tests/helpers/loadApp.js`) regex-extracts the main `<script>` block from `index.html` and patches `const`/`let` to `var` to expose globals. This means:

- All application functions are globally accessible in tests via `global.*`
- New `const`/`let` declarations at the top level in the script block must become `var`, or use `function` declarations
- DOM queries in tests work because jsdom is configured as the test environment
- `DOMParser` and `document.execCommand` are not available in jsdom — avoid calling rich-text helpers that use these in unit tests

### Deployment

GitHub Pages — no build step needed. `git push` to `main` deploys automatically. The `vendor/` directory is committed to the repo.
