# Mikroanalyse

Eine progressive Web-App zur Mikroanalyse von Interaktionen. Schritt für Schritt eine Begegnung reflektieren: Ausgangssituation, Gedanken, Gefühle, Spannung, Bedürfnisse und das eigene Verhalten.

## Funktionen

- Geführter Wizard durch Situation → Runden → Abschluss
- Mehrere Runden pro Analyse (IP startet / Ich starte)
- Vordefinierte und eigene Gefühle (Tag-Eingabe)
- Analyse jederzeit pausieren und fortsetzen (Entwurf)
- Export als PDF (einzeln oder mehrere in einem Dokument) und Textkopie
- Synchronisierung über OneDrive (MSAL / Microsoft-Konto)
- Kein Backend, keine Abhängigkeiten zur Laufzeit — läuft vollständig im Browser

## Deployment (GitHub Pages)

1. Repository auf GitHub pushen
2. **Settings → Pages → Deploy from a branch**
3. Branch: `main`, Ordner: `/ (root)`
4. App ist unter `https://<nutzername>.github.io/<repo>/` erreichbar

Die App benötigt keinen Build-Schritt. `index.html`, `styles.css` und der `vendor/`-Ordner werden direkt ausgeliefert.

## Lokale Entwicklung

```bash
# Abhängigkeiten installieren (nur für Tests und MSAL-Build)
npm install

# Tests ausführen
npm test

# Tests im Watch-Modus
npm run test:watch
```

Mit der VS Code-Extension **Live Server** direkt auf `http://localhost:5500` öffnen (`.vscode/`-Config ist bereits hinterlegt).

## Vendored Bundles

Beide Dateien sind ins Repository eingecheckt, damit GitHub Pages ohne Build-Schritt auskommt:

| Datei | Quelle | Aktualisierung |
|---|---|---|
| `vendor/jspdf.umd.min.js` | [jsPDF](https://github.com/parallax/jsPDF) | manuell herunterladen |
| `vendor/msal-browser.js` | [@azure/msal-browser](https://www.npmjs.com/package/@azure/msal-browser) | `npm run build:msal` |

## Projektstruktur

```
├── index.html          App (Single-Page, kein Framework)
├── styles.css          Styles
├── vendor/             Vendored JS-Bundles (committed)
├── design/             Ablaufdiagramm (D2-Quelle + SVG)
├── tests/              Jest-Testsuite
│   └── helpers/        Test-Infrastruktur (loadApp, setupEnv)
└── .vscode/            VS Code Dev-Config (Live Server + Edge-Debug)
```

## Technologie

- Vanilla JS, kein Framework, kein Build-Schritt
- Persistenz via `localStorage`
- Optional: OneDrive-Sync via MSAL v5
- PDF-Export via jsPDF
- Tests: Jest + jsdom
