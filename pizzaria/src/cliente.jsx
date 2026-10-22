import { useState } from "react";
import { obter, salvarItem } from "./db.js";
import { soDigitos, useRegistro } from "./logic.js";
import { Campo } from "./ui.jsx";

// O cliente se identifica pelo telefone (sem senha); o id fica guardado
// neste aparelho para os próximos pedidos.
const CHAVE = "pz-cliente-id";

export const clienteIdLocal = () => localStorage.getItem(CHAVE);
export const sairCliente = () => {
  localStorage.removeItem(CHAVE);
  window.dispatchEvent(new CustomEvent("pz-mudou", { detail: "cliente" }));
};

export function useClienteAtual() {
  const id = clienteIdLocal();
  const [cliente, carregado, recarregar] = useRegistro(id ? `cliente:${id}` : null, 15000);
  return [id ? cliente : null, id ? carregado : true, recarregar];
}

export function Identificacao({ aoEntrar, titulo = "Identifique-se" }) {
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [precisaNome, setPrecisaNome] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function continuar(e) {
    e.preventDefault();
    const id = soDigitos(telefone);
    if (id.length < 10) return setErro("Informe o celular com DDD.");
    setErro("");
    setOcupado(true);
    try {
      let cliente = await obter(`cliente:${id}`);
      if (!cliente) {
        if (!nome.trim()) { setPrecisaNome(true); return; }
        cliente = { id, nome: nome.trim(), telefone, enderecos: [], saldo: 0, movimentos: [], criadoEm: new Date().toISOString() };
        await salvarItem("cliente", cliente);
      }
      localStorage.setItem(CHAVE, id);
      window.dispatchEvent(new CustomEvent("pz-mudou", { detail: "cliente" }));
      aoEntrar && aoEntrar(cliente);
    } catch (e2) {
      setErro("Não foi possível entrar: " + e2.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="coluna" onSubmit={continuar}>
      {titulo && <h3>{titulo}</h3>}
      <Campo rotulo="Celular (WhatsApp)" type="tel" inputMode="tel" placeholder="(11) 98888-7777" value={telefone} onChange={(e) => setTelefone(e.target.value)} autoFocus />
      {precisaNome && (
        <Campo rotulo="Primeira vez aqui? Como podemos te chamar?" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      )}
      {erro && <div className="pequeno" style={{ color: "#b91c1c" }}>{erro}</div>}
      <button className="btn primario" disabled={ocupado}>{precisaNome ? "Criar cadastro" : "Continuar"}</button>
    </form>
  );
}
