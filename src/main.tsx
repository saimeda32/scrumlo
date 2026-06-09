import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter/wght.css"; // weight axis only (drop italic + opsz); self-hosted
import App from "./App";
import "./styles.css";
import { initTheme } from "./lib/theme";
import { ErrorBoundary } from "./components/ErrorBoundary";

initTheme();

// Surface otherwise-invisible failures instead of a silently broken page.
window.addEventListener("unhandledrejection", (e) => console.error("Unhandled rejection", e.reason));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
