// Theme first, so component styles (imported through App) come later and win over library CSS.
import "./theme/fonts";
import "./theme/tokens.css";
import "./theme/typography.css";
import "./theme/base.css";
import { applyMotionTokens } from "./theme/motion";
import { DEFAULT_SEED, applyTheme } from "./theme/theme";
import { startSettings } from "./features/settings/settingsStore";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

applyTheme(DEFAULT_SEED);
applyMotionTokens();

// Settings first (a few ms), so the app never flashes the wrong theme or colour as it opens.
void startSettings()
  .catch(() => {})
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
