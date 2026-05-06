import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  const fallback = document.createElement("main");
  fallback.className = "root-fallback root-fallback-error";
  fallback.innerHTML = "<strong>Neon Mutant Hatchery</strong><span>Unable to find app root.</span>";
  document.body.appendChild(fallback);
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
