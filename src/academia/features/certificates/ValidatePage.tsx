import { useEffect, useRef, useState } from "react";
import { certificateEngine } from "../../engines/certificate/CertificateEngine";
import { catalogRepo, competencyRepo, settingsRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Field, TextInput } from "../../ui/primitives/Field";
import { formatDateLong } from "../../core/dates";
import { cn } from "../../core/cn";
import { Link } from "../../router/Router";

/**
 * PÁGINA PÚBLICA de validação (/validar-certificado/:codigo).
 * É o destino do QR Code impresso no certificado. Não exige login:
 * qualquer pessoa (cliente, auditoria, candidato) pode conferir.
 */
export function ValidateCertificatePage({ code }: { code?: string }) {
  const [input, setInput] = useState(code ?? "");
  const [checked, setChecked] = useState<{ code: string } | null>(code ? { code } : null);
  const settings = useQuery(() => settingsRepo.get());

  useEffect(() => {
    if (code) {
      setInput(code);
      setChecked({ code });
    }
  }, [code]);

  // A validação registra a consulta (auditoria) — por isso roda em efeito,
  // e não no render, e não repete para o mesmo código.
  const [outcome, setOutcome] = useState<ReturnType<typeof certificateEngine.validate> | null>(null);
  const logged = useRef(new Set<string>());
  useEffect(() => {
    if (!checked) return;
    const target = checked.code.trim().toUpperCase();
    if (logged.current.has(target)) return;
    logged.current.add(target);
    setOutcome(certificateEngine.validate(target));
  }, [checked]);
  const certificate = outcome?.certificate ?? null;
  const course = certificate?.kind === "curso" ? catalogRepo.course(certificate.refId) : undefined;

  const status = outcome?.result;
  const valid = status === "valido";

  return (
    <div className="min-h-[100dvh] bg-linen">
      <header className="bg-navy-900 text-linen-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-copper font-bold text-lg">A</span>
          <div>
            <div className="font-bold leading-tight">Academia ConServ</div>
            <div className="text-[12px] text-sand-300">Validação de certificado</div>
          </div>
          <Link to="/" className="ml-auto text-[13px] font-semibold text-linen-200 underline">Ir para a Academia</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-7 space-y-5">
        <Card className="p-5">
          <h1 className="text-[20px] font-bold">Conferir autenticidade</h1>
          <p className="text-[14px] text-ink-600 mt-1">
            Digite o código impresso no certificado (formato CSV-XXXX-XXXX).
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-end">
            <Field label="Código do certificado" className="flex-1">
              <TextInput
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && setChecked({ code: input })}
                placeholder="CSV-0000-0000"
                className="font-mono tracking-wider"
              />
            </Field>
            <Button size="lg" icon="search" onClick={() => setChecked({ code: input })} disabled={input.trim().length < 4}>
              Validar
            </Button>
          </div>
        </Card>

        {checked && (
          <Card className={cn("p-5", valid ? "border-jade/40 bg-jade/5" : "border-alert/40 bg-alert/5")}>
            <div className="flex items-start gap-3">
              <span className={cn("shrink-0 grid place-items-center w-12 h-12 rounded-2xl text-linen-50", valid ? "bg-jade" : "bg-alert")}>
                <Icon name={valid ? "shield-check" : "alert"} size={24} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[19px] font-bold leading-tight">
                  {status === "valido" && "Certificado válido"}
                  {status === "nao_encontrado" && "Certificado não encontrado"}
                  {status === "revogado" && "Certificado revogado"}
                  {status === "expirado" && "Certificado expirado"}
                </h2>
                <p className="text-[13.5px] text-ink-600 mt-0.5">
                  {status === "nao_encontrado"
                    ? `Não existe certificado com o código ${checked.code} na Academia ConServ.`
                    : `Código ${certificate?.code}`}
                </p>
              </div>
            </div>

            {certificate && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Row label="Colaborador" value={certificate.employeeName} />
                  <Row label="Matrícula" value={certificate.employeeCode} />
                  <Row label="Treinamento" value={certificate.title} />
                  <Row label="Carga horária" value={`${certificate.hours} hora(s)`} />
                  <Row label="Aproveitamento" value={`${certificate.score}%`} />
                  <Row label="Emissão" value={formatDateLong(certificate.issuedAt)} />
                  <Row label="Responsável" value={certificate.responsible} />
                  <Row label="Classificação" value={certificate.classification} />
                </div>

                {certificate.competencies.length > 0 && (
                  <div>
                    <div className="label">Competências</div>
                    <div className="flex flex-wrap gap-1.5">
                      {certificate.competencies.map((id) => (
                        <Chip key={id} tone="navy">{competencyRepo.name(id)}</Chip>
                      ))}
                    </div>
                  </div>
                )}

                {course && (
                  <div>
                    <div className="label">Sobre o treinamento</div>
                    <p className="text-[13.5px] leading-relaxed">{course.description}</p>
                  </div>
                )}

                {certificate.revokedReason && (
                  <div className="rounded-xl border border-alert/30 bg-alert/5 p-3.5">
                    <div className="font-bold text-[13.5px] text-alert mb-0.5">Motivo da revogação</div>
                    <p className="text-[13.5px]">{certificate.revokedReason}</p>
                  </div>
                )}

                <p className="text-[11.5px] text-ink-600 leading-relaxed border-t border-sand/70 pt-3">
                  Este documento comprova participação e aproveitamento em treinamento interno da ConServ Confecções e
                  não constitui, por si, certificação oficial, habilitação legal ou registro profissional.
                  {" "}{settings.legalDisclaimer}
                </p>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sand/70 bg-linen-50 p-3">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-600">{label}</div>
      <div className="text-[14px] font-semibold text-navy-900 mt-0.5 break-words">{value}</div>
    </div>
  );
}
