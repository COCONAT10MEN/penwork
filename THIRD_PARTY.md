# Third-party software and credits

Penwork is built on these open-source projects. Each is used as a normal dependency, unmodified.
Keep these tables up to date whenever a dependency is added or removed.
Licenses below were checked against the installed packages (`package.json` / `LICENSE` files and
`cargo metadata`) on 2026-10-27 (M0) and 2026-10-28 (M1).

## In the app (shipped to users)

| Project | Author | License | Used for |
|---|---|---|---|
| Tauri (`tauri`, `tauri-build`, `@tauri-apps/api`) | Tauri Programme within The Commons Conservancy | MIT / Apache-2.0 | Native app shell |
| React (`react`, `react-dom`) | Meta and contributors | MIT | UI |
| serde, serde_json | Erick Tryzelaar, David Tolnay | MIT / Apache-2.0 | Rust data serialization |
| Roboto Flex (`@fontsource-variable/roboto-flex`) | The Roboto Flex Project Authors (Google); packaged by Fontsource | SIL OFL 1.1 | UI font |
| Caveat (`@fontsource-variable/caveat`) | The Caveat Project Authors (Impallari Type); packaged by Fontsource | SIL OFL 1.1 | Handwriting-style sample text |
| Material Symbols Rounded (`material-symbols`) | Google; packaged by marella/material-symbols | Apache-2.0 | Icons |
| Material Color Utilities (`@material/material-color-utilities`) | Google (material-foundation) | Apache-2.0 | Generating the color theme from a seed |
| Motion (`motion`, with `framer-motion`) | Motion B.V. / Framer B.V. (Matt Perry) | MIT | Spring animations |
| `windows` crate (Windows only) | Microsoft | MIT / Apache-2.0 | Reading the Windows accent color |

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
| Testing Library (`@testing-library/react`, `@testing-library/dom`) | Kent C. Dodds and contributors | MIT | Component behavior tests |
| jsdom | Elijah Insua and contributors | MIT | Browser-like environment for tests |
| `@types/react`, `@types/react-dom`, `@types/node` | DefinitelyTyped contributors | MIT | Type definitions |

## Planned (added in later milestones — verify when installed)

| Project | Author | License | Used for |
|---|---|---|---|
| DOMPurify | Cure53 and contributors | MPL-2.0 or Apache-2.0 | Cleaning deck HTML |
| Playwright (dev only) | Microsoft | Apache-2.0 | Slide parity screenshots |
| pdf.js (`pdfjs-dist`), paused | Mozilla | Apache-2.0 | Rendering PDFs, text layer, search |
| pdf-lib, paused | Andrew Dillon | MIT | Writing annotations into PDFs |
| Zustand | Poimandres | MIT | App state |
| perfect-freehand | Steve Ruiz | MIT | Smooth ink strokes |
| fflate | Arjun Barrett | MIT | `.pwpptx` zip files |

The slide engine in `reference/lop-deck/` is the owner's own work.

Design language: [Material 3 Expressive](https://m3.material.io) by Google. Penwork is not affiliated with Google.
