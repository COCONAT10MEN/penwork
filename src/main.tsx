// Theme first, so component styles (imported through App) come later and win over library CSS.
import "./theme/fonts";
import "./theme/tokens.css";
import "./theme/base.css";
import { DEFAULT_SEED, applyTheme } from "./theme/theme";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Before the first render so there is no flash of the fallback colors in tokens.css.
applyTheme(DEFAULT_SEED);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
