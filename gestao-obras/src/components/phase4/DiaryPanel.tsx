import { EntityForm, Reveal } from "../ui/EntityForm";
import { EmptyState } from "../ui/EmptyState";
import { formatDateTime, formatDay } from "@/lib/format";

type Entry = { id: string; date: Date; weather: string | null; workforce: number | null; activities: string; occurrences: string | null; authorName: string; createdAt: Date };

export function DiaryPanel({ workId, entries, canWrite }: { workId: string; entries: Entry[]; canWrite: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Os registros do diário não podem ser editados nem excluídos; para corrigir, inclua um novo registro.</p>
      {canWrite && (
        <Reveal label="Registrar dia">
          <EntityForm
            action={`/api/works/${workId}/diary`}
            initial={{ date: today }}
            fields={[
              { name: "date", label: "Data", type: "date", required: true },
              { name: "weather", label: "Condições do tempo", maxLength: 120 },
              { name: "workforce", label: "Pessoas trabalhando", type: "number" },
              { name: "activities", label: "Atividades executadas", type: "textarea", required: true, maxLength: 4000 },
              { name: "occurrences", label: "Ocorrências", type: "textarea", maxLength: 4000 },
            ]}
          />
        </Reveal>
      )}
      {entries.length === 0 ? <EmptyState title="Nenhum registro no diário" /> : (
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="card p-4 text-sm">
              <p className="font-medium">{formatDay(e.date)}{e.weather ? ` · ${e.weather}` : ""}{e.workforce !== null ? ` · ${e.workforce} pessoa(s)` : ""}</p>
              <p className="mt-1 whitespace-pre-line text-slate-800">{e.activities}</p>
              {e.occurrences && <p className="mt-1 whitespace-pre-line text-amber-900">Ocorrências: {e.occurrences}</p>}
              <p className="mt-1 text-xs text-slate-500">{e.authorName} · registrado em {formatDateTime(e.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
