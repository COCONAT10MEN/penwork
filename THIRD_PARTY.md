# Third-party software and credits

Penwork is built on these open-source projects. Each is used as a normal dependency, unmodified.
Keep these tables up to date whenever a dependency is added or removed.
Licenses below were checked against the installed packages (`package.json` / `LICENSE` files and
`cargo metadata`) on 2026-10-27.

## In the app (shipped to users)

| Project | Author | License | Used for |
|---|---|---|---|
| Tauri (`tauri`, `tauri-build`, `@tauri-apps/api`) | Tauri Programme within The Commons Conservancy | MIT / Apache-2.0 | Native app shell |
| React (`react`, `react-dom`) | Meta and contributors | MIT | UI |
| serde, serde_json | Erick Tryzelaar, David Tolnay | MIT / Apache-2.0 | Rust data serialization |
| Roboto Flex (`@fontsource-variable/roboto-flex`) | The Roboto Flex Project Authors (Google); packaged by Fontsource | SIL OFL 1.1 | UI font |
| Caveat (`@fontsource-variable/caveat`) | The Caveat Project Authors (Impallari Type); packaged by Fontsource | SIL OFL 1.1 | Handwriting-style sample text |
| Material Symbols Rounded (`material-symbols`) | Google; packaged by marella/material-symbols | Apache-2.0 | Icons |

Tauri pulls in about 240 smaller Rust crates. Almost all are MIT, Apache-2.0, BSD, Zlib, Unicode-3.0
or public domain. Five (`cssparser`, `cssparser-macros`, `selectors`, `dtoa-short`, `option-ext`) are
**MPL-2.0**, a file-level license: it only asks for changes to *those files* to be shared, and we use
them unmodified. They come with every Tauri app. Run `cargo metadata` in `src-tauri/` for the full list.

## Build and development tools (not shipped)

| Project | Author | License | Used for |
|---|---|---|---|
| Tauri CLI (`@tauri-apps/cli`) | Tauri Programme within The Commons Conservancy | MIT / Apache-2.0 | Running and building the app |
| Vite, `@vitejs/plugin-react` | Evan You and contributors | MIT | Dev server and bundler |
| TypeScript | Microsoft | Apache-2.0 | Type checking |
| ESLint, `@eslint/js` | OpenJS Foundation and contributors | MIT | Linting |
| typescript-eslint | typescript-eslint contributors | MIT | TypeScript lint rules |
| eslint-plugin-react-hooks | Meta and contributors | MIT | React hooks lint rules |
| eslint-plugin-react-refresh | Arnaud Barré | MIT | Hot-reload lint rule |
| eslint-config-prettier | Simon Lydell | MIT | Stops ESLint and Prettier overlapping |
| globals | Sindre Sorhus | MIT | Browser/Node global names for ESLint |
| Prettier | James Long and contributors | MIT | Code formatting |
| Vitest | Anthony Fu and contributors | MIT | Unit tests |
| `@types/react`, `@types/react-dom`, `@types/node` | DefinitelyTyped contributors | MIT | Type definitions |

## Planned (added in later milestones — verify when installed)

| Project | Author | License | Used for |
|---|---|---|---|
| pdf.js (`pdfjs-dist`) | Mozilla | Apache-2.0 | Rendering PDFs, text layer, search |
| pdf-lib | Andrew Dillon | MIT | Writing annotations into PDFs |
| Material Color Utilities | Google (material-foundation) | Apache-2.0 | Generating the color theme |
| Motion | Motion Division (Matt Perry) | MIT | Spring animations |
| Zustand | Poimandres | MIT | App state |
| perfect-freehand | Steve Ruiz | MIT | Smooth ink strokes |
| fflate | Arjun Barrett | MIT | `.pwk` zip files |

Design language: [Material 3 Expressive](https://m3.material.io) by Google. Penwork is not affiliated with Google.
