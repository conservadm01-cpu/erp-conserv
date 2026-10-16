/** Seleção de região/unidade para filtros (lista apenas o que está no escopo de quem consulta). */
export function RegionSelect({ units, value, name = "unitId", id = "unitId" }: { units: { id: string; name: string; depth: number }[]; value?: string; name?: string; id?: string }) {
  if (units.length < 2) return null;
  return (
    <div>
      <label className="label" htmlFor={id}>Região / unidade</label>
      <select id={id} name={name} defaultValue={value ?? ""} className="input">
        <option value="">Todo o meu escopo</option>
        {units.map((u) => <option key={u.id} value={u.id}>{"— ".repeat(u.depth)}{u.name}</option>)}
      </select>
    </div>
  );
}
