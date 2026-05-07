# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test           # Run Jest test suite
npm run test:watch # Watch mode for development
npm run build:msal # Rebuild the vendored MSAL bundle (only needed after updating @azure/msal-browser)
```

No build step required for the app itself — serve `index.html` directly (e.g. via VS Code Live Server at `http://localhost:5500`). The browser loads `src/main.js` as a native ES module.

## Architecture

**Vanilla JS single-page PWA** — no framework, no bundler. Application code lives in `src/` as native ES modules. `styles.css` holds all styling. Third-party libs are vendored in `vendor/`.

### Module structure

```
src/
  main.js          Entry point: wires Store._onWrite, calls initNavigation(), bootstrap
  state.js         Single global UI state object (view, step, roundIdx, roundStep, current)
  store.js         localStorage wrapper; tombstone-based deletion for sync
  model.js         newAnalysis / newRound / newThought / migrateRound
  crypto.js        PBKDF2 key derivation + AES-GCM encrypt/decrypt
  sync.js          MSAL v5 OAuth + Microsoft Graph (OneDrive upload/download) + three-way merge
  richtext.js      sanitizeRichText, getRichValue, richEditorHTML, richHtmlToText, renderRichField
  ui.js            headerHTML, progressHTML, sliderHTML, openSheet/closeSheet, showToast
  navigation.js    startNewAnalysis, openDetail, goHome, saveCurrentStep, initNavigation
  renderer.js      render() dispatcher → renderHome / renderWizard / renderDetail
  snapshots.js     Snapshots (localStorage history per analysis)
  utils.js         escapeHtml, escapeAttr, formatDateTime, relativeTime
  views/
    home.js        renderHome, renderAnalysisCard
    wizard.js      renderWizard and all step renderers; exports HUB_STEP, getRoundSequence, saveRoundField
    detail.js      renderDetail, behaviorDetailHTML
    sheets.js      All bottom-sheet UIs: settings, sync, share, bulk export/delete, history, PDF export
```

### Data flow

```
User input (contenteditable / form fields)
  → saveCurrentStep() / saveRoundField() / collectThoughtsFromDom()
  → Store.upsert(analysis)       ← localStorage JSON
  → Store._onWrite()             ← autoSyncDebounced() injected by main.js
  → render()                     ← full DOM replacement
```

`Store._onWrite` is a hook injected by `main.js` after all modules load. This breaks the `store ↔ sync` circular dependency without dynamic imports.

### Rich text fields

Narrative fields use `contenteditable` divs + a 4-button toolbar (F/K/U/•). All helpers live in `src/richtext.js`:

- `richEditorHTML(id, value, placeholder)` — renders toolbar + editor widget
- `sanitizeRichText(html)` — allowlist sanitizer (keeps `<strong>`, `<em>`, `<u>`, `<ul>`, `<li>`, `<br>`, `<p>`)
- `getRichValue(id)` — reads sanitized HTML from a contenteditable
- `renderRichField(value)` — safe rendering in detail view
- `richHtmlToText(html)` — strips HTML for text/PDF export

Old plain-text data in localStorage renders correctly without migration.

### Data model

```js
{
  id: 'a_<timestamp>',
  situation: { title, datetime, mood, need, contextWhat, contextWho, contextWhere },
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

Tests live in `tests/`. `tests/helpers/loadApp.js` imports all `src/` modules via `require()` (esbuild transforms ESM → CJS for Jest) and exposes them as `global.*` for backward compatibility with existing test files.

- `package.json` stays `"type": "commonjs"` — test files are CJS; only `src/*.js` uses ESM syntax
- `jest.esbuild.transform.cjs` handles the ESM → CJS transform using the existing `esbuild` devDep
- `DOMParser` and `document.execCommand` are not available in jsdom — avoid calling rich-text helpers that use these in unit tests
- New functions needed by tests must be exported from their module

### Deployment

GitHub Pages — no build step needed. `git push` to `main` deploys automatically. The `vendor/` directory is committed to the repo.
