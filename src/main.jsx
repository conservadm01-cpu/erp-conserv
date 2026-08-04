import React from "react";
import ReactDOM from "react-dom/client";
import { instalarStorageGlobal } from "./storage.js";
import App from "./App.jsx";

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
