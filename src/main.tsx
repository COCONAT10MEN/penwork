// Theme first, so component styles (imported through App) come later and win over library CSS.
import "./theme/fonts";
import "./theme/tokens.css";
import "./theme/base.css";
import { getSystemSeed, onSystemSeedChange } from "./theme/accent";
import { DEFAULT_SEED, applyTheme } from "./theme/theme";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Before the first render so there is no flash of the fallback colors in tokens.css,
// then swap in the Windows accent color as soon as Rust answers (a few ms).
applyTheme(DEFAULT_SEED);
void getSystemSeed().then((seed) => applyTheme(seed));
void onSystemSeedChange((seed) => applyTheme(seed));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
