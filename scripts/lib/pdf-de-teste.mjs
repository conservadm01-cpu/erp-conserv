// =====================================================================
// PDF DE TESTE — gerador mínimo, sem dependências
// ---------------------------------------------------------------------
// A varredura precisa provar que a Academia lê e analisa PDF de verdade.
// Em vez de guardar um binário no repositório, monta aqui um PDF válido
// (Helvetica, WinAnsiEncoding, uma página por bloco de texto) com
// conteúdo técnico real da ConServ. É o suficiente para o pdfjs extrair
// texto com localizador de página — que é o que alimenta o SOURCE_ID.
// =====================================================================

const LARGURA = 595;   // A4 em pontos
const ALTURA = 842;
const MARGEM = 52;
const CORPO = 11;
const ENTRELINHA = 15.5;
const MAX_CARACTERES = 88;   // cabe na largura útil em Helvetica 11

/** Quebra o parágrafo em linhas que caibam na largura da página. */
function quebrarLinhas(texto) {
  const linhas = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/)) {
    if (!atual.length) atual = palavra;
    else if (`${atual} ${palavra}`.length <= MAX_CARACTERES) atual += ` ${palavra}`;
    else { linhas.push(atual); atual = palavra; }
  }
  if (atual.length) linhas.push(atual);
  return linhas;
}

/** Texto dentro de um literal PDF: escapa parênteses e barra invertida. */
function escaparLiteral(texto) {
  return texto.replace(/([\\()])/g, "\\$1");
}

function fluxoDaPagina(paragrafos) {
  const partes = ["BT", `/F1 ${CORPO} Tf`, `${ENTRELINHA} TL`, `1 ${MARGEM} ${ALTURA - MARGEM} Td`];
  let primeiro = true;
  for (const paragrafo of paragrafos) {
    if (!primeiro) partes.push("T*");           // linha em branco entre parágrafos
    primeiro = false;
    const negrito = paragrafo.startsWith("# ");
    const texto = negrito ? paragrafo.slice(2) : paragrafo;
    if (negrito) partes.push("/F2 12.5 Tf");
    for (const linha of quebrarLinhas(texto)) {
      partes.push(`(${escaparLiteral(linha)}) Tj`, "T*");
    }
    if (negrito) partes.push(`/F1 ${CORPO} Tf`);
  }
  partes.push("ET");
  return partes.join("\n");
}

/**
 * Monta o PDF. `paginas` é uma lista de páginas, cada uma com uma lista
 * de parágrafos (prefixo "# " vira título em negrito).
 * Devolve um Buffer pronto para enviar no campo de arquivo.
 */
export function montarPdf(paginas) {
  const objetos = [];                       // corpo de cada objeto, em ordem
  const idCatalogo = 1;
  const idPaginas = 2;
  const idFonte = 3;
  const idFonteNegrito = 4;
  const primeiroIdPagina = 5;

  const idsDasPaginas = paginas.map((_, i) => primeiroIdPagina + i * 2);
  objetos[idCatalogo] = `<< /Type /Catalog /Pages ${idPaginas} 0 R >>`;
  objetos[idPaginas] =
    `<< /Type /Pages /Kids [${idsDasPaginas.map((id) => `${id} 0 R`).join(" ")}] /Count ${paginas.length} >>`;
  objetos[idFonte] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objetos[idFonteNegrito] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  paginas.forEach((paragrafos, i) => {
    const idPagina = idsDasPaginas[i];
    const idFluxo = idPagina + 1;
    const fluxo = fluxoDaPagina(paragrafos);
    objetos[idPagina] =
      `<< /Type /Page /Parent ${idPaginas} 0 R /MediaBox [0 0 ${LARGURA} ${ALTURA}] ` +
      `/Resources << /Font << /F1 ${idFonte} 0 R /F2 ${idFonteNegrito} 0 R >> >> /Contents ${idFluxo} 0 R >>`;
    objetos[idFluxo] =
      `<< /Length ${Buffer.byteLength(fluxo, "latin1")} >>\nstream\n${fluxo}\nendstream`;
  });

  // Monta o arquivo guardando o deslocamento de cada objeto (tabela xref).
  let arquivo = "%PDF-1.4\n";
  const deslocamentos = [];
  for (let id = 1; id < objetos.length; id += 1) {
    deslocamentos[id] = Buffer.byteLength(arquivo, "latin1");
    arquivo += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }
  const inicioXref = Buffer.byteLength(arquivo, "latin1");
  const total = objetos.length;           // objetos 1..N mais a entrada livre 0
  arquivo += `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let id = 1; id < total; id += 1) {
    arquivo += `${String(deslocamentos[id]).padStart(10, "0")} 00000 n \n`;
  }
  arquivo += `trailer\n<< /Size ${total} /Root ${idCatalogo} 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(arquivo, "latin1");
}

/** Material técnico de exemplo: duas páginas, com definições e roteiro. */
export const PAGINAS_EXEMPLO = [
  [
    "# Pressão do pé calcador e arraste do tecido",
    "Material interno de apoio à capacitação — ConServ Confecções. Conteúdo educativo.",
    "# 1. O que é a pressão do pé calcador",
    "A pressão do pé calcador é a força com que o pé prensa o tecido contra o dente de transporte. " +
      "É essa força que garante que o tecido ande na velocidade da máquina, sem escorregar e sem ser esticado. " +
      "Pressão é diferente de altura: altura é o quanto o pé sobe; pressão é o quanto ele aperta.",
    "O dente de transporte é a peça serrilhada que avança sob a chapa de agulha e empurra o tecido a cada ponto. " +
      "Quando a pressão está correta, o dente trabalha e o tecido apenas acompanha; quando está alta, o dente " +
      "marca o tecido e a malha sai alongada na costura.",
    "# 2. Sinais de pressão alta",
    "Pressão alta deixa marca de dente no avesso, alonga a malha na direção da costura e cansa a mão da " +
      "costureira, que precisa segurar o tecido para não deformar. Em tecido leve, a pressão alta também " +
      "provoca franzido miúdo ao longo de toda a carreira de pontos.",
    "# 3. Sinais de pressão baixa",
    "Pressão baixa faz o tecido escorregar: o ponto sai com comprimento irregular, a costura foge do traçado " +
      "e a máquina deixa de arrastar no início da carreira. Em tecido grosso, a pressão baixa aparece como " +
      "ponto curto nas passagens de costura e sobreposição de camadas.",
  ],
  [
    "# 4. Roteiro de regulagem da pressão",
    "1. Pare a máquina e desligue a chave geral antes de qualquer ajuste.",
    "2. Coloque duas camadas do mesmo tecido da produção sob o pé calcador.",
    "3. Solte a contraporca do parafuso de pressão, no topo da cabeça da máquina.",
    "4. Gire o parafuso no sentido anti-horário até sentir o tecido folgar.",
    "5. Aperte um quarto de volta por vez e costure uma amostra a cada ajuste.",
    "6. Pare quando o tecido andar sozinho, sem marca de dente e sem escorregar.",
    "7. Reaperte a contraporca e refaça a amostra para conferir o resultado.",
    "# 5. Limites do posto de trabalho",
    "Barulho novo, peça solta, cheiro de queimado ou esforço anormal do motor não são assunto de regulagem. " +
      "Nesses casos a conduta é uma só: pare a máquina e solicite apoio da manutenção. Não retire proteção " +
      "de agulha nem de correia para investigar.",
    "# 6. Registro na ficha da máquina",
    "Toda regulagem de pressão deve ser anotada na ficha da máquina, com a data, o tecido usado na amostra " +
      "e o nome de quem ajustou. A ficha é o que permite voltar ao ponto anterior quando o resultado piora.",
  ],
];
