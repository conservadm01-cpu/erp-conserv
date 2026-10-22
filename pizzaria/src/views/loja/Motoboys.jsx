import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { salvarItem, removerItem, uid } from "../../db.js";
import { brl, hora, useColecao, useConfig, ehHoje, repasseMotoboy } from "../../logic.js";
import { Modal, Campo, toast, BotaoConfirmar } from "../../ui.jsx";

const VAZIO = { nome: "", telefone: "", cpf: "", veiculo: "", placa: "", cnh: "", pix: "", pin: "", ativo: true };
const AO_VIVO_MS = 2 * 60 * 1000;

export default function Motoboys() {
  const [cfg] = useConfig();
  const [motoboys] = useColecao("motoboy");
  const [pedidos] = useColecao("pedido", 15000);
  const [locs] = useColecao("loc", 10000);
  const [editando, setEditando] = useState(null);

  return (
    <div className="coluna">
      <div className="linha">
        <h2>Motoboys</h2>
        <button className="btn primario direita" onClick={() => setEditando({ ...VAZIO })}><Plus size={16} /> Cadastrar motoboy</button>
      </div>
      <div className="suave pequeno">
        O motoboy entra pelo link <b>{window.location.origin}/#/motoboy</b> com o nome e o PIN cadastrados aqui.
      </div>
      {motoboys.length === 0 && <div className="vazio">Nenhum motoboy cadastrado.</div>}
      <div className="grade">
        {motoboys.map((m) => {
          const doDia = pedidos.filter((p) => p.motoboyId === m.id && p.status === "entregue" && ehHoje(p.criadoEm));
          const emRota = pedidos.filter((p) => p.motoboyId === m.id && p.status === "em_rota").length;
          const loc = locs.find((l) => l.motoboyId === m.id);
          const online = loc && Date.now() - new Date(loc.em).getTime() < AO_VIVO_MS;
          return (
            <div key={m.id} className="cartao coluna" style={{ gap: 6, opacity: m.ativo === false ? 0.55 : 1 }}>
              <div className="linha entre">
                <h3>🛵 {m.nome}</h3>
                {online ? <span className="selo" style={{ background: "#15803d" }}>GPS ativo</span> : <span className="selo claro">{loc ? `visto ${hora(loc.em)}` : "offline"}</span>}
              </div>
              <div className="suave pequeno">{m.telefone} · {m.veiculo} {m.placa}</div>
              <div className="pequeno">
                Hoje: <b>{doDia.length}</b> entrega(s) · repasse <b>{brl(doDia.reduce((s, p) => s + repasseMotoboy(p, cfg), 0))}</b>
                {emRota > 0 && <> · <b>{emRota}</b> em rota</>}
              </div>
              <div className="linha">
                <button className="btn pequeno" onClick={() => setEditando({ ...VAZIO, ...m })}><Pencil size={14} /> Editar</button>
                <button className="btn pequeno" onClick={() => salvarItem("motoboy", { ...m, ativo: m.ativo === false })}>{m.ativo === false ? "Reativar" : "Desativar"}</button>
                <BotaoConfirmar className="btn pequeno perigo direita" texto="Excluir?" aoConfirmar={() => removerItem("motoboy", m.id)}><Trash2 size={14} /></BotaoConfirmar>
              </div>
            </div>
          );
        })}
      </div>
      {editando && <FormMotoboy inicial={editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}

function FormMotoboy({ inicial, aoFechar }) {
  const [m, setM] = useState(inicial);
  const set = (c, v) => setM({ ...m, [c]: v });
  async function salvar(e) {
    e.preventDefault();
    if (!m.nome.trim()) return toast("Informe o nome.");
    if (!/^\d{4,6}$/.test(m.pin)) return toast("O PIN deve ter de 4 a 6 números.");
    await salvarItem("motoboy", { ...m, id: m.id || uid(), nome: m.nome.trim() });
    toast("Motoboy salvo");
    aoFechar();
  }
  return (
    <Modal titulo={m.id ? "Editar motoboy" : "Novo motoboy"} aoFechar={aoFechar}>
      <form className="coluna" onSubmit={salvar}>
        <Campo rotulo="Nome" value={m.nome} onChange={(e) => set("nome", e.target.value)} autoFocus />
        <div className="campos">
          <Campo rotulo="Celular" type="tel" value={m.telefone} onChange={(e) => set("telefone", e.target.value)} />
          <Campo rotulo="CPF" value={m.cpf} onChange={(e) => set("cpf", e.target.value)} />
        </div>
        <div className="campos">
          <Campo rotulo="Moto (modelo)" value={m.veiculo} onChange={(e) => set("veiculo", e.target.value)} />
          <Campo rotulo="Placa" value={m.placa} onChange={(e) => set("placa", e.target.value.toUpperCase())} />
        </div>
        <div className="campos">
          <Campo rotulo="CNH" value={m.cnh} onChange={(e) => set("cnh", e.target.value)} />
          <Campo rotulo="Chave Pix (repasse)" value={m.pix} onChange={(e) => set("pix", e.target.value)} />
        </div>
        <Campo rotulo="PIN de acesso (4 a 6 números)" inputMode="numeric" value={m.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))} />
        <label className="check"><input type="checkbox" checked={m.ativo !== false} onChange={(e) => set("ativo", e.target.checked)} /> Ativo</label>
        <button className="btn primario">Salvar</button>
      </form>
    </Modal>
  );
}
