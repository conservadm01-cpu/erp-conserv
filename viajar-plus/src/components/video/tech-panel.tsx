import { Card, CardBody, CardHeader } from "@/components/ui/card";

/** Explica as opções técnicas de processamento de vídeo e suas limitações. */
export function TechPanel() {
  return (
    <Card>
      <CardHeader title="Como o vídeo é processado" subtitle="Tudo acontece no seu aparelho; nada é enviado a servidores para editar." />
      <CardBody>
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-accent">Ver detalhes técnicos e limitações</summary>
          <div className="mt-4 space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-semibold">Abordagem usada: Canvas + MediaRecorder + WebAudio</h3>
              <p className="text-muted">
                Cada clipe é desenhado num canvas com títulos, legendas e transições; o som de cada clipe e a trilha são mixados com WebAudio; o resultado é
                gravado com MediaRecorder. Vantagens: sem downloads extras, funciona em Chrome, Edge e Firefox de computador e Android. Limitações: a
                exportação ocorre em <strong>tempo real</strong> (60 s de vídeo levam ~60 s), a aba precisa ficar visível, o formato depende do navegador
                (WebM VP8/VP9 na maioria; MP4 no Safari recente) e a qualidade varia com o desempenho do aparelho.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">WebCodecs (avaliado)</h3>
              <p className="text-muted">
                Codifica quadro a quadro mais rápido que o tempo real e com controle fino de qualidade, mas exige montar o contêiner MP4/WebM manualmente
                (biblioteca de muxing) e o suporte ainda é desigual — no Safari/iOS o encoder de vídeo chegou recentemente e o de áudio é limitado. É o
                próximo passo natural para acelerar exportações em navegadores compatíveis.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">FFmpeg.wasm (avaliado)</h3>
              <p className="text-muted">
                Oferece cortes sem recompressão e muitos formatos, porém baixa ~25–30 MB, roda 5–20× mais devagar que o FFmpeg nativo, consome muita memória
                (vídeos 4K de celular podem travar a aba) e a versão multithread exige cabeçalhos COOP/COEP que bloqueiam recursos de terceiros. Por isso não
                foi adotado como padrão.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">iPhone / iPad (Safari)</h3>
              <p className="text-muted">
                Vídeos HEVC/MOV podem não decodificar em outros navegadores; a gravação de canvas no iOS é instável em montagens longas. Prefira 720p e
                montagens curtas, ou exporte no computador.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">Processamento em servidor (opcional, não implementado)</h3>
              <p className="text-muted">
                Para aparelhos que não conseguem exportar, uma fila com FFmpeg no servidor seria possível. Ela exigiria: consentimento explícito para enviar os
                vídeos, limites de duração/tamanho por usuário, exclusão automática dos arquivos após o processamento e estimativa de custo antes de iniciar
                (armazenamento + minutos de CPU). Esta opção está documentada como pendente e não está ativa no MVP.
              </p>
            </section>
          </div>
        </details>
      </CardBody>
    </Card>
  );
}
