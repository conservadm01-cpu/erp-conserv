import React from "react";
import ReactDOM from "react-dom/client";
import { instalarStorageGlobal } from "./storage.js";
import App from "./App.jsx";

// Adicionado: captura o evento de instalação (usado pelo botão "Fixar
// atalho na área de trabalho" na tela de login) o quanto antes — se
// esperássemos montar o App para registrar esse listener, correríamos o
// risco do navegador já ter disparado o evento e perdê-lo. Guardamos em
// window para o LoginGate ler quando montar, e disparamos um evento
// próprio para o caso de ele já estar montado quando isso chegar.
window.__deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
  window.dispatchEvent(new Event("pwa-install-available"));
});
window.addEventListener("appinstalled", () => {
  window.__deferredInstallPrompt = null;
  window.dispatchEvent(new Event("pwa-install-available"));
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Precisa rodar antes de montar o App, pois os hooks de dados chamam
// window.storage assim que os componentes montam.
//
// Corrigido: se faltar a configuração do Supabase, instalarStorageGlobal
// já mostra na tela o que precisa ser feito e devolve false — nesse caso
// não montamos o App, senão ele quebraria em seguida tentando ler dados
// de um banco que não existe, trocando a mensagem útil por um erro seco.
const pronto = instalarStorageGlobal();

if (pronto) {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
