// Theme first, so component styles (imported through App) come later and win over library CSS.
import "./theme/fonts";
import "./theme/tokens.css";
import "./theme/base.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
