import { useState } from "react";
import { createRoot } from "react-dom/client";
import Home from "@/app/page";
import DemoBar from "./DemoBar";
import { patchCamera, seedExemplo } from "./sim";

// A fila de envio fica no IndexedDB do aparelho; na demo o banco começa do
// zero a cada carregamento, então a fila também.
try { indexedDB.deleteDatabase("construcam-fila"); } catch { /* sem IndexedDB */ }
patchCamera();
void seedExemplo();

function DemoApp() {
  const [key, setKey] = useState(0);
  return <>
    <Home key={key}/>
    <DemoBar onRemount={() => setKey(k => k + 1)}/>
  </>;
}

createRoot(document.getElementById("root")!).render(<DemoApp/>);
