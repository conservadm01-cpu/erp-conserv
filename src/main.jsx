import React from "react";
import ReactDOM from "react-dom/client";
import { instalarStorageGlobal } from "./storage.js";
import App from "./App.jsx";

// Precisa rodar antes de montar o App, pois os hooks de dados chamam
// window.storage assim que os componentes montam.
instalarStorageGlobal();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
