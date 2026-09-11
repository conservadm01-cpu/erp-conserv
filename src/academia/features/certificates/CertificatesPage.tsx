import { certificateRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip, StatusChip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { EmptyState } from "../../ui/primitives/Feedback";
import { CertificateDocument } from "./CertificateDocument";
import { formatDate } from "../../core/dates";
import { certificateEngine } from "../../engines/certificate/CertificateEngine";

export function CertificatesPage() {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const certificates = useQuery(() => (employee ? certificateRepo.ofEmployee(employee.id) : []), [employee?.id]);

  return (
    <div>
      <PageHeader title="Meus certificados" subtitle="Comprovantes dos treinamentos que você concluiu." icon="award" />

      {certificates.length === 0 ? (
        <EmptyState
          icon="award"
          title="Nenhum certificado ainda"
          description="Conclua as aulas de um curso e atinja a nota mínima na avaliação para receber seu primeiro certificado."
          action={<Button icon="compass" onClick={() => navigate("/trilhas")}>Ver trilhas</Button>}
        />
      ) : (
        <div className="space-y-3">
          {certificates.map((certificate) => (
            <Card key={certificate.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className="shrink-0 grid place-items-center w-11 h-11 rounded-xl bg-copper/15 text-copper-600 border border-copper/25">
                  <Icon name="award" size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[15.5px] leading-snug">{certificate.title}</h3>
                  <p className="text-[13px] text-ink-600 mt-0.5">
                    {formatDate(certificate.issuedAt)} · {certificate.hours}h · aproveitamento {certificate.score}%
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <StatusChip status={certificate.status} />
                    <Chip tone="neutral">{certificate.code}</Chip>
                  </div>
                  <p className="text-[11.5px] text-ink-400 mt-1.5">{certificate.classification}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" icon="eye" onClick={() => navigate(`/certificado/${certificate.code}`)}>Ver</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function CertificateViewPage({ code }: { code: string }) {
  const { navigate } = useRouter();
  const certificate = useQuery(() => certificateRepo.byCode(code), [code]);

  if (!certificate) {
    return (
      <EmptyState
        icon="award"
        title="Certificado não encontrado"
        description={`Nenhum certificado com o código ${code}.`}
        action={<Button onClick={() => navigate("/certificados")}>Meus certificados</Button>}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap gap-2 mb-4 no-print">
        <Button variant="secondary" icon="arrow-left" onClick={() => navigate("/certificados")}>Voltar</Button>
        <Button icon="printer" onClick={() => window.print()}>Imprimir / salvar PDF</Button>
        <Button variant="secondary" icon="shield-check" onClick={() => navigate(certificateEngine.validationPath(certificate.code))}>
          Página de validação
        </Button>
      </div>
      <CertificateDocument certificate={certificate} />
    </div>
  );
}
