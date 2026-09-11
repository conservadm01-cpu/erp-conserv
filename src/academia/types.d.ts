// =====================================================================
// Declarações de módulos sem tipos próprios.
// =====================================================================

/**
 * Ajudante de leitura de PDF do pdfjs. Importamos este módulo para que a
 * leitura rode no thread da página (ver extractors/pdf.ts); o pacote não
 * publica tipos para ele, e a única coisa que usamos é o objeto inteiro.
 */
declare module "pdfjs-dist/build/pdf.worker.min.mjs" {
  const WorkerMessageHandler: unknown;
  export { WorkerMessageHandler };
}
