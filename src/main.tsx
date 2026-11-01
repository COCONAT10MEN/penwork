// Theme first, so component styles (imported through App) come later and win over library CSS.
import "./theme/fonts";
import "./theme/tokens.css";
import "./theme/typography.css";
import "./theme/base.css";
import { applyMotionTokens } from "./theme/motion";
import { installPress } from "./ui/press";
import { DEFAULT_SEED, applyTheme } from "./theme/theme";
import { startSettings } from "./features/settings/settingsStore";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

applyTheme(DEFAULT_SEED);
applyMotionTokens();
installPress();

// Until their font arrives icons are invisible words as wide as their names, which lays the whole
// page out wrongly and then jumps. It's a big font, so it gets a limit.
const FONT_WAIT_MS = 1500;
const fontsReady = Promise.race([
  Promise.all([
    document.fonts.load('24px "Material Symbols Rounded"', "home"),
    document.fonts.load('16px "Roboto Flex Variable"'),
  ]),
  new Promise((done) => setTimeout(done, FONT_WAIT_MS)),
]).catch(() => {});

// Settings first (a few ms), so the app never flashes the wrong theme or colour as it opens.
void Promise.all([startSettings().catch(() => {}), fontsReady]).finally(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
