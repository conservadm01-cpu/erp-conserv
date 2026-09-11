import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Certificate } from "../../core/types";
import { catalogRepo, competencyRepo } from "../../data/repositories";
import { certificateEngine } from "../../engines/certificate/CertificateEngine";
import { formatDateLong } from "../../core/dates";
import { Icon } from "../../ui/primitives/Icon";

/**
 * Documento do certificado (seção 13). Pensado para imprimir: a página
 * usa o diálogo do navegador, gerando PDF sem serviço externo.
 * O QR Code aponta para /validar-certificado/<codigo>.
 */
export function CertificateDocument({ certificate }: { certificate: Certificate }) {
  const [qr, setQr] = useState<string>();
  const url = certificateEngine.validationUrl(certificate.code);

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#1c2b39", light: "#fffdf7" } })
      .then(setQr)
      .catch(() => setQr(undefined));
  }, [url]);

  const sources = certificate.librarySourceIds
    .map((id) => catalogRepo.source(id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <div className="print-area bg-linen-50 border border-sand rounded-2xl shadow-card overflow-hidden">
      <div className="h-2.5 bg-gradient-to-r from-navy-900 via-navy to-copper" />
      <div className="p-6 sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-600">ConServ Confecções</div>
            <div className="text-[13px] text-ink-400">Academia ConServ · Conhecimento que vira qualidade</div>
          </div>
          <div className="grid place-items-center w-12 h-12 rounded-xl bg-navy text-linen-50 font-bold text-xl shrink-0">A</div>
        </div>

        <h1 className="mt-7 text-[26px] sm:text-[34px] font-bold tracking-tight text-navy-900 leading-tight">
          Certificado de Conclusão
        </h1>
        <p className="text-[13.5px] text-ink-600 mt-1">{certificate.classification}</p>

        <div className="mt-7 space-y-1.5">
          <p className="text-[14px] text-ink-600">Certificamos que</p>
          <p className="text-[24px] sm:text-[30px] font-bold text-navy-900 leading-tight">{certificate.employeeName}</p>
          <p className="text-[13.5px] text-ink-600">Matrícula {certificate.employeeCode}</p>
        </div>

        <div className="mt-6 space-y-1.5">
          <p className="text-[14px] text-ink-600">concluiu o treinamento interno</p>
          <p className="text-[20px] sm:text-[24px] font-bold text-navy-900 leading-snug">{certificate.title}</p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <Info label="Carga horária" value={`${certificate.hours} hora(s)`} />
          <Info label="Aproveitamento" value={`${certificate.score}%`} />
          <Info label="Data de emissão" value={formatDateLong(certificate.issuedAt)} />
        </div>

        {certificate.competencies.length > 0 && (
          <div className="mt-6">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-600 mb-1.5">Competências desenvolvidas</div>
            <p className="text-[13.5px] leading-relaxed">
              {certificate.competencies.map((id) => competencyRepo.name(id)).join(" · ")}
            </p>
          </div>
        )}

        <div className="mt-8 grid sm:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <div className="h-px bg-ink/30 max-w-[260px]" />
            <p className="text-[13px] font-semibold mt-1.5">{certificate.responsible}</p>
            <p className="text-[11.5px] text-ink-600">Responsável pelo treinamento</p>

            <div className="mt-5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-ink-600">Código de validação</div>
              <div className="font-mono text-[16px] font-bold tracking-wider text-navy-900">{certificate.code}</div>
              <p className="text-[11.5px] text-ink-600 mt-1 max-w-sm break-all">
                Valide em: {url}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-center">
            {qr ? (
              <img src={qr} alt={`QR Code de validação do certificado ${certificate.code}`} className="w-[132px] h-[132px] rounded-lg border border-sand bg-linen-50" />
            ) : (
              <div className="w-[132px] h-[132px] rounded-lg border border-sand grid place-items-center text-ink-400">
                <Icon name="image" size={28} />
              </div>
            )}
            <p className="text-[10.5px] text-ink-600 mt-1.5 max-w-[132px]">Aponte a câmera para conferir a autenticidade</p>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-sand/70 space-y-2">
          <p className="text-[11.5px] text-ink-600 leading-relaxed">
            <strong>Natureza do documento:</strong> {certificate.classification.toLowerCase()}. Este documento comprova
            participação e aproveitamento em treinamento interno da ConServ Confecções e não constitui, por si, certificação
            oficial, habilitação legal ou registro profissional.
          </p>
          {sources.length > 0 && (
            <p className="text-[11px] text-ink-400 leading-relaxed">
              <strong>Referências do conteúdo:</strong> {sources.map((s) => `${s.name} (${s.institution})`).join("; ")}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sand/70 bg-linen-100/60 p-3">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-600">{label}</div>
      <div className="text-[15px] font-bold text-navy-900 mt-0.5">{value}</div>
    </div>
  );
}
