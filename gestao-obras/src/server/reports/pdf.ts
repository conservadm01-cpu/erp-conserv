import PDFDocument from "pdfkit";

const C = { ink: "#16202e", muted: "#5b6878", line: "#c9d1dc", brand: "#1c4878", band: "#eef2f7" };
const MARGIN = 48;

export type Column = { header: string; width: number; align?: "left" | "right" | "center" };

/**
 * Relatório PDF gerencial com cabeçalho, identificação, data de geração e
 * paginação. Não contém assinatura: o rodapé deixa isso explícito.
 */
export class Report {
  readonly doc: PDFKit.PDFDocument;
  private chunks: Buffer[] = [];
  private done: Promise<Buffer>;

  constructor(private opts: { title: string; subject: string; generatedBy: string; generatedAt?: Date }) {
    this.doc = new PDFDocument({ size: "A4", margins: { top: 96, bottom: 64, left: MARGIN, right: MARGIN }, bufferPages: true, info: { Title: opts.title, Subject: opts.subject, Creator: "Gestão de Obras" } });
    this.done = new Promise((resolve, reject) => {
      this.doc.on("data", (c: Buffer) => this.chunks.push(c));
      this.doc.on("end", () => resolve(Buffer.concat(this.chunks)));
      this.doc.on("error", reject);
    });
    this.doc.font("Helvetica").fontSize(10).fillColor(C.ink);
  }

  private get width() {
    return this.doc.page.width - MARGIN * 2;
  }

  private ensureSpace(h: number) {
    if (this.doc.y + h > this.doc.page.height - this.doc.page.margins.bottom) this.doc.addPage();
  }

  heading(text: string) {
    this.ensureSpace(40);
    this.doc.moveDown(0.8).font("Helvetica-Bold").fontSize(12).fillColor(C.brand).text(text, MARGIN);
    const y = this.doc.y + 2;
    this.doc.moveTo(MARGIN, y).lineTo(MARGIN + this.width, y).lineWidth(0.6).strokeColor(C.line).stroke();
    this.doc.moveDown(0.5).font("Helvetica").fontSize(10).fillColor(C.ink);
  }

  paragraph(text: string, opts: { muted?: boolean; size?: number } = {}) {
    this.ensureSpace(20);
    this.doc.font("Helvetica").fontSize(opts.size ?? 10).fillColor(opts.muted ? C.muted : C.ink).text(text || "—", MARGIN, undefined, { width: this.width });
    this.doc.fillColor(C.ink).moveDown(0.3);
  }

  /** Pares rótulo/valor em duas colunas. */
  fields(pairs: [string, string | null | undefined][]) {
    const colW = this.width / 2;
    for (let i = 0; i < pairs.length; i += 2) {
      this.ensureSpace(30);
      const y = this.doc.y;
      let maxY = y;
      [pairs[i], pairs[i + 1]].forEach((p, j) => {
        if (!p) return;
        const x = MARGIN + j * colW;
        this.doc.font("Helvetica").fontSize(7.5).fillColor(C.muted).text(p[0].toUpperCase(), x, y, { width: colW - 12, characterSpacing: 0.4 });
        this.doc.font("Helvetica").fontSize(10).fillColor(C.ink).text(p[1] || "—", x, undefined, { width: colW - 12 });
        maxY = Math.max(maxY, this.doc.y);
      });
      this.doc.y = maxY + 6;
    }
    this.doc.x = MARGIN;
  }

  table(columns: Column[], rows: string[][], empty = "Nenhum registro.") {
    const total = columns.reduce((s, c) => s + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * this.width);
    const drawHeader = () => {
      const y = this.doc.y;
      this.doc.rect(MARGIN, y, this.width, 18).fill(C.band);
      let x = MARGIN;
      this.doc.font("Helvetica-Bold").fontSize(8).fillColor(C.muted);
      columns.forEach((c, i) => {
        this.doc.text(c.header.toUpperCase(), x + 4, y + 5, { width: widths[i]! - 8, align: c.align ?? "left", lineBreak: false });
        x += widths[i]!;
      });
      this.doc.y = y + 22;
    };
    this.ensureSpace(40);
    drawHeader();
    if (!rows.length) {
      this.paragraph(empty, { muted: true });
      return;
    }
    this.doc.font("Helvetica").fontSize(9).fillColor(C.ink);
    for (const row of rows) {
      const h = Math.max(...row.map((cell, i) => this.doc.heightOfString(cell || "—", { width: widths[i]! - 8 }))) + 8;
      if (this.doc.y + h > this.doc.page.height - this.doc.page.margins.bottom) {
        this.doc.addPage();
        drawHeader();
        this.doc.font("Helvetica").fontSize(9).fillColor(C.ink);
      }
      const y = this.doc.y;
      let x = MARGIN;
      row.forEach((cell, i) => {
        this.doc.text(cell || "—", x + 4, y + 4, { width: widths[i]! - 8, align: columns[i]!.align ?? "left" });
        x += widths[i]!;
      });
      this.doc.moveTo(MARGIN, y + h).lineTo(MARGIN + this.width, y + h).lineWidth(0.4).strokeColor(C.line).stroke();
      this.doc.y = y + h + 2;
    }
    this.doc.x = MARGIN;
    this.doc.moveDown(0.4);
  }

  /** Cabeçalho e rodapé em todas as páginas; encerra e devolve o PDF. */
  async finish(): Promise<Buffer> {
    const range = this.doc.bufferedPageRange();
    const at = (this.opts.generatedAt ?? new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      const { width, height } = this.doc.page;
      const saved = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 0;
      this.doc.rect(0, 0, width, 6).fill(C.brand);
      this.doc.font("Helvetica-Bold").fontSize(14).fillColor(C.ink).text(this.opts.title, MARGIN, 30, { width: width - MARGIN * 2, lineBreak: false });
      this.doc.font("Helvetica").fontSize(9).fillColor(C.muted).text(this.opts.subject, MARGIN, 50, { width: width - MARGIN * 2, lineBreak: false });
      this.doc.moveTo(MARGIN, 72).lineTo(width - MARGIN, 72).lineWidth(0.6).strokeColor(C.line).stroke();
      this.doc.font("Helvetica").fontSize(7.5).fillColor(C.muted);
      this.doc.text(`Gerado em ${at} por ${this.opts.generatedBy}. Documento gerencial emitido pelo sistema — não contém assinatura e não substitui documentos formalmente assinados.`, MARGIN, height - 44, { width: width - MARGIN * 2 - 70 });
      this.doc.text(`Página ${i - range.start + 1} de ${range.count}`, width - MARGIN - 70, height - 44, { width: 70, align: "right" });
      this.doc.page.margins.bottom = saved;
    }
    this.doc.end();
    return this.done;
  }
}

export const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
export const fmtDateTime = (d: Date | null | undefined) => (d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
