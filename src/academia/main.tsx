import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// =====================================================================
// Ponto de entrada da Academia ConServ (academia.html).
// O ERP continua com o seu próprio ponto de entrada (src/main.jsx).
// =====================================================================

// PWA: registra o service worker mínimo (mesmo usado pelo ERP), que
// torna o app instalável na tela inicial do celular.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const container = document.getElementById("academia-root");
if (container) {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
