"""Gera a ficha técnica interativa do produto (PDF com campos preenchíveis).

Uso:  python3 gerar_ficha_produto.py
Saída: ficha-tecnica-produto.pdf (em branco) e
       ficha-tecnica-produto-exemplo.pdf (Margherita preenchida)

Os campos amarelos são calculados por JavaScript do próprio PDF (funciona no
Adobe Acrobat Reader, Foxit e similares). Em visualizadores sem JavaScript,
os campos continuam preenchíveis; só o cálculo automático não acontece.
"""
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, BooleanObject, DictionaryObject, NameObject, TextStringObject
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

AQUI = Path(__file__).parent
W, H = A4
M = 36  # margem

FORNO = HexColor("#16251d")
FORNO2 = HexColor("#21362a")
TOMATE = HexColor("#d4412a")
OURO = HexColor("#f0b94a")
OURO_CLARO = HexColor("#fdf3d8")
FARINHA = HexColor("#f5f3ee")
LINHA = HexColor("#d3cbbd")
TEXTO = HexColor("#1c1814")
SUAVE = HexColor("#6f675d")
VERDE = HexColor("#2e7a48")
CAMPO = HexColor("#ffffff")

N_INSUMOS = 14
N_ETAPAS = 8
TAM = ["B", "M", "G"]
TAM_NOME = {"B": "Broto", "M": "Média", "G": "Grande"}

estilo = ParagraphStyle("t", fontName="Helvetica", fontSize=9.5, leading=13, textColor=TEXTO)
estilo_suave = ParagraphStyle("s", parent=estilo, fontSize=8.5, leading=11.5, textColor=SUAVE)
estilo_branco = ParagraphStyle("b", parent=estilo, textColor=white, fontSize=10, leading=14)

# Campos calculados: nome -> script de cálculo (JavaScript do Acrobat).
CALCULOS = {}


def T(y):
    """Converte 'distância do topo' em coordenada do reportlab."""
    return H - y


def paragrafo(c, texto, x, y_topo, largura, st=estilo):
    p = Paragraph(texto, st)
    _, h = p.wrap(largura, 1000)
    p.drawOn(c, x, T(y_topo) - h)
    return h


def xadrez(c, y_topo, altura=7):
    passo = altura
    x = 0
    i = 0
    while x < W:
        for linha in range(2):
            c.setFillColor(TOMATE if (i + linha) % 2 == 0 else white)
            c.rect(x, T(y_topo) - altura / 2 * (linha + 1), passo, altura / 2, stroke=0, fill=1)
        x += passo
        i += 1


def cabecalho(c, etapa, titulo, resumo):
    c.setFillColor(FORNO)
    c.rect(0, T(78), W, 78, stroke=0, fill=1)
    xadrez(c, 78)
    c.setFillColor(OURO)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(M, T(28), f"ETAPA {etapa} DE 6" if etapa else "FICHA TÉCNICA DO PRODUTO")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 21)
    c.drawString(M, T(54), titulo)
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#c9d6cd"))
    c.drawString(M, T(68), resumo)


def rodape(c, pagina):
    c.setFont("Helvetica", 7.5)
    c.setFillColor(SUAVE)
    c.drawString(M, 20, "Ficha técnica do produto · Pizzaria · campos amarelos são calculados automaticamente")
    c.drawRightString(W - M, 20, f"{pagina} / 7")


def rotulo(c, texto, x, y_topo, tam=7.5, cor=SUAVE):
    c.setFont("Helvetica-Bold", tam)
    c.setFillColor(cor)
    c.drawString(x, T(y_topo), texto.upper())


def campo(c, nome, x, y_topo, largura, altura=18, dica="", maxlen=None, multilinha=False, calc=None, tam=9, valor=""):
    """Campo de texto. y_topo = borda de cima do campo."""
    flags = []
    if multilinha:
        flags.append("multiline")
    if calc:
        flags.append("readOnly")
        CALCULOS[nome] = calc
    kw = dict(
        name=nome, tooltip=dica or nome, x=x, y=T(y_topo) - altura, width=largura, height=altura,
        fontName="Helvetica", fontSize=tam, borderWidth=0.8, borderColor=LINHA,
        fillColor=OURO_CLARO if calc else CAMPO, textColor=TEXTO, fieldFlags=" ".join(flags),
        forceBorder=True, value=valor,
    )
    if maxlen:
        kw["maxlen"] = maxlen
    c.acroForm.textfield(**kw)


def caixa_marcar(c, nome, x, y_topo, texto, dica="", marcado=False):
    c.acroForm.checkbox(
        name=nome, tooltip=dica or texto, x=x, y=T(y_topo) - 11, size=11, buttonStyle="check",
        borderColor=SUAVE, fillColor=white, textColor=TOMATE, forceBorder=True, checked=marcado,
    )
    c.setFont("Helvetica", 9)
    c.setFillColor(TEXTO)
    c.drawString(x + 16, T(y_topo) - 9, texto)


def lista(c, nome, x, y_topo, largura, opcoes, valor=None, altura=18):
    c.acroForm.choice(
        name=nome, tooltip=nome, value=valor or opcoes[0], options=opcoes, x=x, y=T(y_topo) - altura,
        width=largura, height=altura, fontName="Helvetica", fontSize=9, borderWidth=0.8,
        borderColor=LINHA, fillColor=CAMPO, textColor=TEXTO, fieldFlags="combo edit", forceBorder=True,
    )


def nota(c, x, y_topo, largura, titulo, texto, cor=VERDE):
    """Caixa 'Por que importa' ao lado dos campos."""
    p = Paragraph(texto, estilo_suave)
    _, h = p.wrap(largura - 20, 1000)
    altura = h + 30
    c.setFillColor(FARINHA)
    c.setStrokeColor(FARINHA)
    c.roundRect(x, T(y_topo) - altura, largura, altura, 6, stroke=0, fill=1)
    c.setFillColor(cor)
    c.rect(x, T(y_topo) - altura, 3, altura, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(x + 12, T(y_topo) - 15, titulo)
    p.drawOn(c, x + 12, T(y_topo) - 22 - h)
    return altura


def secao(c, texto, y_topo):
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(FORNO)
    c.drawString(M, T(y_topo), texto)
    c.setStrokeColor(OURO)
    c.setLineWidth(2)
    c.line(M, T(y_topo + 5), M + 28, T(y_topo + 5))
    c.setLineWidth(1)


# ---------------------------------------------------------------- páginas

def pagina_capa(c, v):
    cabecalho(c, 0, "Do custo à imagem na tela", "Como preencher a ficha de cada produto antes de cadastrá-lo no sistema")
    y = 104
    h = paragrafo(c, (
        "Esta ficha reúne, num só lugar, tudo o que um produto precisa para ser vendido com lucro e bem apresentado: "
        "<b>o que vai nele e quanto custa</b>, <b>como é feito</b> e <b>como aparece</b> para o cliente no site, no totem, "
        "na TV e nas telas LCD com ESP32. Preencha uma ficha por produto; depois é só copiar os dados para "
        "<b>Loja → Produtos</b>."), M, y, W - 2 * M)
    y += h + 18

    etapas = [
        ("1", "Identificação", "Nome, categoria, tamanhos, nome curto para a tela LCD."),
        ("2", "Insumos e consumo", "Cada ingrediente, quanto custa e quanto vai em cada tamanho."),
        ("3", "Custo e preço", "Perdas, embalagem, gás, mão de obra, impostos e margem: preço sugerido e CMV."),
        ("4", "Processo de produção", "Passo a passo, tempos e pontos de controle. Dá o tempo de preparo."),
        ("5", "Imagem e textos", "Foto padronizada e textos do tamanho certo para cada tela."),
        ("6", "Publicação", "Onde lançar cada dado no sistema e a conferência final."),
    ]
    larg = (W - 2 * M - 2 * 12) / 3
    alt = 86
    for i, (n, nome, desc) in enumerate(etapas):
        col, lin = i % 3, i // 3
        x = M + col * (larg + 12)
        yt = y + lin * (alt + 14)
        c.setFillColor(FORNO if i < 5 else TOMATE)
        c.roundRect(x, T(yt) - alt, larg, alt, 8, stroke=0, fill=1)
        c.setFillColor(OURO)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(x + 12, T(yt) - 30, n)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x + 34, T(yt) - 27, nome)
        p = Paragraph(desc, ParagraphStyle("c", parent=estilo, textColor=HexColor("#d7e2da"), fontSize=8.5, leading=11))
        p.wrap(larg - 24, 100)
        p.drawOn(c, x + 12, T(yt) - 44 - p.height)
        if col < 2:
            c.setFillColor(OURO)
            cx = x + larg + 6
            cy = T(yt) - alt / 2
            c.circle(cx, cy, 3.5, stroke=0, fill=1)
    y += 2 * alt + 14 + 26

    secao(c, "Como usar este PDF", y)
    y += 18
    dicas = [
        "<b>Campos brancos</b>: você digita. <b>Campos amarelos</b>: o PDF calcula sozinho (abra no Adobe Acrobat Reader, "
        "Foxit ou outro leitor com formulários; no navegador os cálculos podem não rodar, mas dá para preencher).",
        "Use <b>vírgula</b> nos valores (12,50). Use sempre a <b>mesma unidade</b> na compra e no consumo: se comprou em kg, "
        "lance o consumo em kg (120 g = 0,120).",
        "Salve um arquivo por produto (ex.: <i>ficha-margherita.pdf</i>). Revise quando o fornecedor mudar o preço: o custo "
        "e o preço sugerido se atualizam na hora.",
        "O exemplo preenchido (<i>ficha-tecnica-produto-exemplo.pdf</i>) mostra uma Margherita com valores de referência.",
    ]
    for d in dicas:
        c.setFillColor(TOMATE)
        c.circle(M + 4, T(y) - 5, 2.2, stroke=0, fill=1)
        y += paragrafo(c, d, M + 14, y, W - 2 * M - 14) + 7

    y += 10
    secao(c, "Ficha", y)
    y += 16
    rotulo(c, "Produto", M, y + 8)
    campo(c, "capa_produto", M, y + 12, 250, valor=v.get("capa_produto", ""))
    rotulo(c, "Código / SKU", M + 262, y + 8)
    campo(c, "capa_sku", M + 262, y + 12, 90, valor=v.get("capa_sku", ""))
    rotulo(c, "Versão / data", M + 364, y + 8)
    campo(c, "capa_data", M + 364, y + 12, W - 2 * M - 364, valor=v.get("capa_data", ""))
    rodape(c, 1)


def pagina_identificacao(c, v):
    cabecalho(c, 1, "Identificação do produto", "Quem é o produto e como ele será chamado em cada tela")
    y = 100
    xn = W - M - 190  # coluna das notas
    lc = xn - M - 14  # largura da coluna de campos

    secao(c, "Nome e categoria", y)
    y += 22
    rotulo(c, "Nome no cardápio (site, totem, TV) — até 40 caracteres", M, y)
    campo(c, "nome", M, y + 4, lc, maxlen=40, valor=v.get("nome", ""))
    y += 34
    rotulo(c, "Nome curto para LCD — até 22 letras", M, y)
    campo(c, "nome_lcd", M, y + 4, lc * 0.62, maxlen=22, valor=v.get("nome_lcd", ""))
    rotulo(c, "Categoria", M + lc * 0.62 + 10, y)
    lista(c, "categoria", M + lc * 0.62 + 10, y + 4, lc * 0.38 - 10,
          ["Pizzas", "Pizzas doces", "Bebidas", "Sobremesas", "Outros"], v.get("categoria"))
    y += 34
    rotulo(c, "Responsável pela ficha", M, y)
    campo(c, "responsavel", M, y + 4, lc * 0.62, valor=v.get("responsavel", ""))
    rotulo(c, "Data", M + lc * 0.62 + 10, y)
    campo(c, "data", M + lc * 0.62 + 10, y + 4, lc * 0.38 - 10, valor=v.get("data", ""))
    nota(c, xn, 100, 190, "Por que importa", (
        "O nome aparece no site e na TV com acentos. A tela LCD do ESP32 só tem letras sem acento e pouco espaço "
        "(320 px de largura), por isso um nome curto: <b>4 Queijos</b> em vez de <b>Pizza Quatro Queijos Especial</b>. "
        "O sistema tira os acentos sozinho."))

    y += 44
    secao(c, "Tamanhos vendidos", y)
    y_tam = y
    y += 14
    cols = [("Tamanho", 74), ("Vende?", 46), ("Diâmetro (cm)", 76), ("Fatias", 52), ("Massa (g)", 82)]
    x = M
    for t, w in cols:
        rotulo(c, t, x, y + 8)
        x += w
    y += 14
    for s, nome in [("B", "Broto"), ("M", "Média"), ("G", "Grande"), ("U", "Único (bebidas, sobremesas)")]:
        x = M
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(TEXTO)
        c.drawString(x, T(y) - 12, nome if s != "U" else "Único")
        x += cols[0][1]
        c.acroForm.checkbox(name=f"vende_{s}", tooltip=f"Vende {nome}", x=x + 4, y=T(y) - 14, size=12,
                            buttonStyle="check", borderColor=SUAVE, fillColor=white, textColor=TOMATE,
                            forceBorder=True, checked=v.get(f"vende_{s}", False))
        x += cols[1][1]
        for campo_nome, w in [("diam", cols[2][1]), ("fatias", cols[3][1]), ("massa", cols[4][1])]:
            if s == "U":
                break
            campo(c, f"{campo_nome}_{s}", x, y, w - 10, valor=v.get(f"{campo_nome}_{s}", ""))
            x += w
        y += 24
    nota(c, xn, y_tam - 8, 190, "Por que importa", (
        "Diâmetro, fatias e peso da massa padronizam o produto: toda Grande sai igual, o custo da etapa 2 fica certo "
        "e o cliente sabe o que está comprando (o site mostra o tamanho em cada opção)."))

    y += 12
    secao(c, "Venda e restrições", y)
    y += 16
    caixa_marcar(c, "meio_a_meio", M, y, "Pode ser meio a meio (cobra o sabor mais caro)", marcado=v.get("meio_a_meio", False))
    y += 20
    rotulo(c, "Vender em", M, y + 8)
    y += 12
    for i, (n, t) in enumerate([("canal_delivery", "Delivery (site)"), ("canal_mesa", "Mesa (QR code)"), ("canal_totem", "Totem"), ("canal_tv", "TV / LCD")]):
        caixa_marcar(c, n, M + i * 118, y, t, marcado=v.get(n, False))
    y += 24
    rotulo(c, "Contém / indicado para", M, y + 8)
    y += 12
    alerg = [("al_gluten", "Glúten"), ("al_lactose", "Lactose"), ("al_ovo", "Ovo"), ("al_castanha", "Castanhas"),
             ("al_vegetariano", "Vegetariano"), ("al_vegano", "Vegano"), ("al_picante", "Picante")]
    for i, (n, t) in enumerate(alerg):
        caixa_marcar(c, n, M + (i % 4) * 118, y + (i // 4) * 20, t, marcado=v.get(n, False))
    y += 46
    nota(c, M, y, W - 2 * M, "Dica", (
        "Alergênicos e a indicação vegetariana entram no fim da descrição do produto (ex.: <i>\"Contém glúten e lactose.\"</i>). "
        "É uma informação que o cliente procura antes de pedir, principalmente no totem e na mesa, onde não há atendente ao lado."))
    rodape(c, 2)


def pagina_insumos(c, v):
    cabecalho(c, 2, "Insumos e consumo", "Ficha técnica: o que vai no produto, quanto custa e quanto se usa em cada tamanho")
    y = 96
    h = paragrafo(c, (
        "Liste cada ingrediente e embalagem interna (molho, queijo, cobertura, massa, azeite, orégano...). "
        "<b>Preço pago</b> e <b>quantidade da embalagem</b> vêm da nota do fornecedor; o PDF calcula o <b>custo por unidade</b>. "
        "Em <b>Usa</b>, lance quanto vai em cada tamanho, <b>na mesma unidade</b> da compra. "
        "Exemplo: mussarela comprada a R$ 42,00 o kg (qtd. 1) e usada 0,180 kg na Média."), M, y, W - 2 * M)
    y += h + 12

    cols = [("Insumo", 128), ("Unid.", 42), ("Preço R$", 62), ("Qtd. embal.", 54), ("Custo / unid.", 64),
            ("Usa Broto", 52), ("Usa Média", 52), ("Usa Grande", 69)]
    x = M
    c.setFillColor(FORNO)
    c.rect(M, T(y) - 20, W - 2 * M, 20, stroke=0, fill=1)
    for t, w in cols:
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(white)
        c.drawString(x + 4, T(y) - 13, t.upper())
        x += w
    y += 22
    for k in range(1, N_INSUMOS + 1):
        x = M
        g = lambda n: v.get(f"{n}_{k}", "")
        campo(c, f"i_nome_{k}", x, y, cols[0][1] - 4, valor=g("i_nome")); x += cols[0][1]
        lista(c, f"i_un_{k}", x, y, cols[1][1] - 4, ["kg", "g", "L", "ml", "un"], v.get(f"i_un_{k}")); x += cols[1][1]
        campo(c, f"i_preco_{k}", x, y, cols[2][1] - 4, valor=g("i_preco")); x += cols[2][1]
        campo(c, f"i_qtd_{k}", x, y, cols[3][1] - 4, valor=g("i_qtd")); x += cols[3][1]
        campo(c, f"i_cu_{k}", x, y, cols[4][1] - 4, valor=g("i_cu"),
              calc=f'var p=pzN("i_preco_{k}"),q=pzN("i_qtd_{k}");event.value=(p>0&&q>0)?pzF(p/q,4):"";')
        x += cols[4][1]
        for s, (_, w) in zip(TAM, cols[5:]):
            campo(c, f"i_{s.lower()}_{k}", x, y, w - 4, valor=v.get(f"i_{s.lower()}_{k}", "")); x += w
        y += 21

    # Totais
    y += 4
    c.setFillColor(FARINHA)
    c.rect(M, T(y) - 26, W - 2 * M, 26, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 9.5)
    c.setFillColor(FORNO)
    c.drawString(M + 8, T(y) - 17, "Custo dos insumos por unidade vendida (R$)")
    x = M + sum(w for _, w in cols[:5])
    for s, (_, w) in zip(TAM, cols[5:]):
        soma = "+".join(f'pzN("i_cu_{k}")*pzN("i_{s.lower()}_{k}")' for k in range(1, N_INSUMOS + 1))
        campo(c, f"ins_{s}", x, y + 4, w - 4, valor=v.get(f"ins_{s}", ""), calc=f"var t={soma};event.value=t>0?pzF(t,2):\"\";")
        x += w
    y += 40
    nota(c, M, y, (W - 2 * M - 12) / 2, "Por que importa", (
        "É a base de todo o resto: sem o custo real dos insumos, o preço é chute. Pese os ingredientes de uma pizza "
        "de verdade, de cada tamanho, pelo menos uma vez, e use a média de 3 pesagens."))
    nota(c, M + (W - 2 * M) / 2 + 6, y, (W - 2 * M - 12) / 2, "Não esqueça", (
        "Massa (farinha, fermento, óleo), molho, sal e orégano também são insumos. A <b>caixa</b> e os <b>sachês</b> "
        "entram na etapa 3, como embalagem, porque só vão no delivery e no balcão."), cor=TOMATE)
    rodape(c, 3)


def pagina_custo(c, v):
    cabecalho(c, 3, "Custo e preço de venda", "Do custo dos insumos ao preço sugerido, CMV e lucro por tamanho")
    y = 100
    secao(c, "Percentuais sobre o preço", y)
    y += 18
    for i, (n, t, d) in enumerate([("imp", "Impostos (%)", "Ex.: Simples Nacional 6"), ("taxa", "Taxa cartão / app (%)", "Ex.: 3"),
                                   ("margem", "Margem de lucro (%)", "Ex.: 20")]):
        x = M + i * 172
        rotulo(c, t, x, y)
        campo(c, n, x, y + 4, 70, dica=d, valor=v.get(n, ""))
        c.setFont("Helvetica", 8)
        c.setFillColor(SUAVE)
        c.drawString(x + 76, T(y + 16), d)
    y += 40

    secao(c, "Custo por tamanho", y)
    y += 12
    xl = M
    lrot = 220
    lcol = (W - 2 * M - lrot) / 3
    for i, s in enumerate(TAM):
        c.setFillColor(FORNO)
        c.rect(xl + lrot + i * lcol + 2, T(y) - 20, lcol - 4, 20, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(xl + lrot + i * lcol + lcol / 2, T(y) - 13, TAM_NOME[s].upper())
    y += 26

    def linha(rot, desc, nome_base, calc_fn=None, destaque=False):
        nonlocal y
        if destaque:
            c.setFillColor(FARINHA)
            c.rect(M, T(y) - 24, W - 2 * M, 26, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(TOMATE if destaque else TEXTO)
        c.drawString(M + 4, T(y) - 9, rot)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(SUAVE)
        c.drawString(M + 4, T(y) - 19, desc)
        for i, s in enumerate(TAM):
            campo(c, f"{nome_base}_{s}", xl + lrot + i * lcol + 4, y, lcol - 8, valor=v.get(f"{nome_base}_{s}", ""),
                  calc=calc_fn(s) if calc_fn else None)
        y += 30

    linha("Custo dos insumos (R$)", "vem da etapa 2", "insumos",
          lambda s: f'var t=pzN("ins_{s}");event.value=t>0?pzF(t,2):"";')
    linha("Perda e quebra (%)", "sobras, erros, pizza que queima — use 3 a 8", "perda")
    linha("Embalagem (R$)", "caixa, sachês, guardanapo, lacre", "emb")
    linha("Gás / energia (R$)", "gasto do forno dividido pelas pizzas do mês", "gas")
    linha("Mão de obra (R$)", "folha da cozinha dividida pelas pizzas do mês", "mo")
    linha("Custo total por unidade (R$)", "insumos + perda + embalagem + gás + mão de obra", "custo",
          lambda s: (f'var t=pzN("insumos_{s}")*(1+pzN("perda_{s}")/100)+pzN("emb_{s}")+pzN("gas_{s}")+pzN("mo_{s}");'
                     'event.value=t>0?pzF(t,2):"";'), destaque=True)
    linha("Preço sugerido (R$)", "custo ÷ (1 − impostos − taxa − margem)", "sugerido",
          lambda s: (f'var c=pzN("custo_{s}"),d=1-(pzN("imp")+pzN("taxa")+pzN("margem"))/100;'
                     'event.value=c>0?(d>0?pzF(c/d,2):"revise %"):"";'), destaque=True)
    linha("Preço de venda praticado (R$)", "o preço que vai no sistema", "preco")
    linha("CMV (%)", "custo total ÷ preço praticado", "cmv",
          lambda s: (f'var c=pzN("custo_{s}"),p=pzN("preco_{s}");event.value=(c>0&&p>0)?pzF(c/p*100,1)+" %":"";'))
    linha("Lucro por unidade (R$)", "preço − custo − impostos − taxa", "lucro",
          lambda s: (f'var c=pzN("custo_{s}"),p=pzN("preco_{s}");'
                     'var l=p-c-p*(pzN("imp")+pzN("taxa"))/100;event.value=(c>0&&p>0)?pzF(l,2):"";'))
    linha("Desconto máximo em promoção", "acima disso a venda dá prejuízo", "descmax",
          lambda s: (f'var c=pzN("custo_{s}"),p=pzN("preco_{s}");'
                     'var l=p-c-p*(pzN("imp")+pzN("taxa"))/100;'
                     'event.value=(c>0&&p>0)?(l>0?pzF(l/p*100,0)+" %":"prejuízo"):"";'), destaque=True)

    y += 8
    larg = (W - 2 * M - 12) / 2
    nota(c, M, y, larg, "Leitura do CMV", (
        "Em pizzaria, o custo do produto costuma ficar entre <b>25% e 35%</b> do preço. Acima de <b>40%</b>, revise: "
        "porção, fornecedor ou preço. Abaixo de 20%, confira se algum insumo ficou de fora."))
    nota(c, M + larg + 12, y, larg, "Promoções", (
        "Antes de criar um cupom ou a \"terça da pizza\" em <b>Loja → Promoções</b>, confira o <b>desconto máximo</b>. "
        "O frete grátis também é custo: some a taxa de entrega média quando avaliar."), cor=TOMATE)
    rodape(c, 4)


ETAPAS_PADRAO = [
    ("Porcionar a massa", "Pesar a bola conforme o tamanho e deixar fermentar"),
    ("Abrir o disco", "Abrir à mão até o diâmetro da etapa 1, borda uniforme"),
    ("Molho", "Espalhar com concha medida, deixando 1,5 cm de borda"),
    ("Cobertura", "Ingredientes na ordem da ficha, pesados por tamanho"),
    ("Forno", "Assar na temperatura e no tempo indicados abaixo"),
    ("Finalização", "Manjericão, azeite ou parmesão depois do forno"),
    ("Corte e embalagem", "Cortar no número de fatias, caixa com lacre"),
    ("Conferência e saída", "Conferir com o pedido antes de entregar ou servir"),
]


def pagina_processo(c, v):
    cabecalho(c, 4, "Processo de produção", "Passo a passo padronizado: toda pizza sai igual, em qualquer turno")
    y = 100
    cols = [("#", 18), ("Etapa", 120), ("O que fazer (padrão)", 247), ("Tempo (min)", 70), ("Temp. (°C)", 68)]
    c.setFillColor(FORNO)
    c.rect(M, T(y) - 20, W - 2 * M, 20, stroke=0, fill=1)
    x = M
    for t, w in cols:
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(white)
        c.drawString(x + 4, T(y) - 13, t.upper())
        x += w
    y += 22
    for k in range(1, N_ETAPAS + 1):
        padrao = ETAPAS_PADRAO[k - 1]
        x = M
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(TOMATE)
        c.drawString(x + 4, T(y) - 14, str(k))
        x += cols[0][1]
        campo(c, f"etapa_{k}", x, y, cols[1][1] - 4, valor=v.get(f"etapa_{k}", padrao[0])); x += cols[1][1]
        campo(c, f"fazer_{k}", x, y, cols[2][1] - 4, tam=8, valor=v.get(f"fazer_{k}", padrao[1])); x += cols[2][1]
        campo(c, f"tempo_{k}", x, y, cols[3][1] - 4, valor=v.get(f"tempo_{k}", "")); x += cols[3][1]
        campo(c, f"temp_{k}", x, y, cols[4][1] - 4, valor=v.get(f"temp_{k}", ""))
        y += 22
    y += 4
    c.setFillColor(FARINHA)
    c.rect(M, T(y) - 26, W - 2 * M, 26, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 9.5)
    c.setFillColor(FORNO)
    c.drawString(M + 8, T(y) - 17, "Tempo total de preparo (min) — deixe em branco o que é feito antes do pedido")
    soma = "+".join(f'pzN("tempo_{k}")' for k in range(1, N_ETAPAS + 1))
    campo(c, "tempo_total", M + sum(w for _, w in cols[:3]), y + 4, cols[3][1] - 4,
          valor=v.get("tempo_total", ""), calc=f"var t={soma};event.value=t>0?pzF(t,0):\"\";")
    y += 44

    secao(c, "Parâmetros do forno e da massa", y)
    y += 18
    params = [("fermentacao", "Fermentação (horas)"), ("forno_temp", "Forno (°C)"), ("forno_tempo", "Tempo de forno (min)"),
              ("validade_massa", "Validade da massa (h)")]
    lp = (W - 2 * M - 3 * 10) / 4
    for i, (n, t) in enumerate(params):
        rotulo(c, t, M + i * (lp + 10), y)
        campo(c, n, M + i * (lp + 10), y + 4, lp, valor=v.get(n, ""))
    y += 40

    secao(c, "Pontos de controle", y)
    y += 14
    ctrl = [("pc_higiene", "Bancada e mãos higienizadas antes de começar"),
            ("pc_validade", "Validade e aparência dos insumos conferidas"),
            ("pc_geladeira", "Geladeira dos insumos a até 5 °C"),
            ("pc_peso", "Porções pesadas (não no olho)"),
            ("pc_conferencia", "Pedido conferido antes de sair (sabor, tamanho, observação)"),
            ("pc_lacre", "Caixa de delivery com lacre")]
    for i, (n, t) in enumerate(ctrl):
        caixa_marcar(c, n, M + (i % 2) * 262, y + (i // 2) * 20, t, marcado=v.get(n, False))
    y += 70
    larg = (W - 2 * M - 12) / 2
    nota(c, M, y, larg, "No sistema", (
        "O <b>tempo total</b> vira o <b>tempo de preparo</b> em <b>Configurações</b> (delivery e salão). É ele que calcula "
        "a previsão mostrada ao cliente no acompanhamento do pedido e no totem."))
    nota(c, M + larg + 12, y, larg, "Por que importa", (
        "Processo escrito permite treinar gente nova rápido, mantém o sabor igual em todo turno e faz o custo da etapa 3 "
        "valer na prática: se cada um põe o queijo \"no olho\", o CMV real foge do calculado."), cor=TOMATE)
    rodape(c, 5)


def mock_card_web(c, x, y_topo, w):
    """Desenho de como o produto aparece no site/totem."""
    h = 150
    c.setFillColor(white)
    c.setStrokeColor(LINHA)
    c.roundRect(x, T(y_topo) - h, w, h, 8, stroke=1, fill=1)
    c.setFillColor(HexColor("#f1ece2"))
    c.rect(x + 1, T(y_topo) - 82, w - 2, 81, stroke=0, fill=1)
    cx, cy = x + w / 2, T(y_topo) - 41
    c.setFillColor(HexColor("#e7a43c")); c.circle(cx, cy, 32, stroke=0, fill=1)
    c.setFillColor(HexColor("#c8361d")); c.circle(cx, cy, 26, stroke=0, fill=1)
    c.setFillColor(HexColor("#f4d48a")); c.circle(cx, cy, 24, stroke=0, fill=1)
    c.setFillColor(VERDE)
    for dx, dy in [(-9, 6), (8, 10), (4, -10), (-12, -7)]:
        c.circle(cx + dx, cy + dy, 4, stroke=0, fill=1)
    c.setFillColor(TEXTO); c.setFont("Helvetica-Bold", 10); c.drawString(x + 10, T(y_topo) - 98, "Nome no cardápio")
    c.setFillColor(SUAVE); c.setFont("Helvetica", 7.5)
    c.drawString(x + 10, T(y_topo) - 110, "Descrição para web/totem (2 linhas)")
    c.drawString(x + 10, T(y_topo) - 120, "aparecem; o resto é cortado...")
    c.setFillColor(TEXTO); c.setFont("Helvetica-Bold", 10); c.drawString(x + 10, T(y_topo) - 140, "R$ 58,00")
    c.setFillColor(TOMATE); c.circle(x + w - 18, T(y_topo) - 136, 9, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 11); c.drawCentredString(x + w - 18, T(y_topo) - 140, "+")
    return h


def mock_lcd(c, x, y_topo, w):
    h = w * 0.75
    c.setFillColor(HexColor("#222222"))
    c.roundRect(x - 6, T(y_topo) - h - 6, w + 12, h + 12, 5, stroke=0, fill=1)
    c.setFillColor(HexColor("#000000")); c.rect(x, T(y_topo) - h, w, h, stroke=0, fill=1)
    c.setFillColor(HexColor("#c8361d")); c.rect(x, T(y_topo) - 14, w, 14, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Courier-Bold", 7.5); c.drawString(x + 4, T(y_topo) - 10, "PIZZARIA")
    c.drawRightString(x + w - 4, T(y_topo) - 10, "1/3")
    c.setFillColor(HexColor("#ffb400")); c.setFont("Courier-Bold", 8.5); c.drawString(x + 4, T(y_topo) - 27, "Pizzas")
    linhas = [("Margherita", "58,00"), ("4 Queijos", "66,00"), ("Calabresa", "55,00"), ("Portuguesa", "62,00")]
    yy = 40
    for n, p in linhas:
        c.setFillColor(white); c.setFont("Courier", 7.5); c.drawString(x + 4, T(y_topo) - yy, n)
        c.setFillColor(HexColor("#ffb400")); c.drawRightString(x + w - 4, T(y_topo) - yy, p)
        yy += 12
    c.setFillColor(HexColor("#1e5f37")); c.rect(x, T(y_topo) - h, w, 11, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Courier", 6.5); c.drawString(x + 4, T(y_topo) - h + 3, "* Terca da pizza: 15% off")
    return h + 6


def pagina_imagem(c, v):
    cabecalho(c, 5, "Imagem e textos de apresentação", "A foto e os textos que o cliente vê no site, no totem, na TV e na tela LCD")
    y = 100
    xr = W - M - 170  # coluna dos desenhos
    lc = xr - M - 18

    secao(c, "Checklist da foto", y)
    y += 14
    foto = [("f_luz", "Luz natural ou difusa, sem flash direto"),
            ("f_fundo", "Fundo neutro e limpo (madeira, pedra, toalha lisa)"),
            ("f_angulo", "Pizza inteira vista de cima (90°) ou a 45°"),
            ("f_real", "Produto real, igual ao que o cliente recebe"),
            ("f_texto", "Sem texto, logo, preço ou moldura na foto"),
            ("f_formato", "Horizontal 4:3, no mínimo 1200 × 900 px"),
            ("f_peso", "JPG ou WebP com até 300 KB"),
            ("f_arquivo", "Nome sem espaço nem acento: margherita-grande.jpg")]
    for i, (n, t) in enumerate(foto):
        caixa_marcar(c, n, M, y + i * 19, t, marcado=v.get(n, False))
    y += len(foto) * 19 + 12

    rotulo(c, "Link da imagem (URL pública) — vai em Produtos → Foto", M, y)
    campo(c, "img_url", M, y + 4, lc, tam=8, valor=v.get("img_url", ""))
    y += 32
    rotulo(c, "Arquivo", M, y)
    campo(c, "img_arquivo", M, y + 4, lc * 0.5 - 6, valor=v.get("img_arquivo", ""))
    rotulo(c, "Foto feita por / data", M + lc * 0.5 + 6, y)
    campo(c, "img_autor", M + lc * 0.5 + 6, y + 4, lc * 0.5 - 6, valor=v.get("img_autor", ""))
    y += 40

    secao(c, "Textos", y)
    y += 18
    rotulo(c, "Descrição para site e totem — até 120 caracteres", M, y)
    campo(c, "desc_web", M, y + 4, lc, altura=34, multilinha=True, maxlen=120, valor=v.get("desc_web", ""))
    y += 48
    rotulo(c, "Descrição curta para a TV — até 70 caracteres", M, y)
    campo(c, "desc_tv", M, y + 4, lc, maxlen=70, valor=v.get("desc_tv", ""))
    y += 32
    rotulo(c, "Chamada de promoção (opcional) — até 40 caracteres", M, y)
    campo(c, "chamada", M, y + 4, lc, maxlen=40, valor=v.get("chamada", ""))
    y += 34
    h = paragrafo(c, (
        "Escreva os ingredientes principais na ordem em que o cliente sente o sabor, sem adjetivos vazios: "
        "<i>\"Molho de tomate, mussarela, tomate fresco e manjericão. Contém glúten e lactose.\"</i>"), M, y, lc, estilo_suave)

    # Coluna de desenhos
    yd = 100
    rotulo(c, "Site, mesa e totem", xr, yd, cor=FORNO)
    yd += 8
    yd += mock_card_web(c, xr, yd, 170) + 10
    c.setFont("Helvetica", 7.5); c.setFillColor(SUAVE)
    c.drawString(xr, T(yd), "Foto 4:3 + nome + descrição + preço")
    yd += 22
    rotulo(c, "Tela LCD ESP32 (320 × 240)", xr, yd, cor=FORNO)
    yd += 10
    yd += mock_lcd(c, xr + 6, yd, 158) + 10
    p = Paragraph("A tela LCD <b>não mostra foto</b>: usa o nome curto da etapa 1 e o preço. Sem acentos.", estilo_suave)
    p.wrap(170, 100); p.drawOn(c, xr, T(yd) - p.height)
    yd += p.height + 14
    rotulo(c, "TV do salão", xr, yd, cor=FORNO)
    yd += 6
    c.setFillColor(FORNO); c.roundRect(xr, T(yd) - 46, 170, 46, 5, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 9); c.drawString(xr + 8, T(yd) - 15, "Nome no cardápio")
    c.setFillColor(OURO); c.drawString(xr + 8, T(yd) - 28, "Broto 32,00   Grande 58,00")
    c.setFillColor(HexColor("#a9b8ad")); c.setFont("Helvetica", 7); c.drawString(xr + 8, T(yd) - 39, "Descrição curta para a TV")
    rodape(c, 6)


def pagina_publicacao(c, v):
    cabecalho(c, 6, "Publicação no sistema", "Onde lançar cada informação da ficha e a conferência final")
    y = 98
    linhas = [
        ("Nome, categoria, descrição para site", "Loja → Produtos → Novo produto"),
        ("Link da imagem", "Produtos → Foto (link da imagem)"),
        ("Tamanhos e preço praticado (etapa 3)", "Produtos → Tamanhos e preços"),
        ("Pode ser meio a meio", "Produtos → \"Pode ser meio a meio\""),
        ("Tempo total de preparo (etapa 4)", "Configurações → Tempo de preparo (delivery e salão)"),
        ("Desconto máximo (etapa 3)", "Promoções → não criar desconto maior que esse"),
        ("Vender na TV / tela LCD", "Telas e TV → marcar a categoria na tela (atualiza sozinho)"),
        ("Custo, CMV e processo", "Fica com a gestão (esta ficha). Revise quando o preço do insumo mudar."),
    ]
    c.setFillColor(FORNO)
    c.rect(M, T(y) - 20, W - 2 * M, 20, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 7.5)
    c.drawString(M + 6, T(y) - 13, "INFORMAÇÃO DA FICHA")
    c.drawString(M + 220, T(y) - 13, "ONDE LANÇAR")
    y += 20
    for i, (a, b) in enumerate(linhas):
        if i % 2 == 0:
            c.setFillColor(FARINHA); c.rect(M, T(y) - 22, W - 2 * M, 22, stroke=0, fill=1)
        c.setFillColor(TEXTO); c.setFont("Helvetica-Bold", 8.5); c.drawString(M + 6, T(y) - 14, a)
        c.setFont("Helvetica", 8.5); c.drawString(M + 220, T(y) - 14, b)
        y += 22
    y += 20

    secao(c, "Conferência final", y)
    y += 14
    confs = [("ok_cadastro", "Produto cadastrado no sistema com todos os tamanhos"),
             ("ok_preco", "Preços conferidos com a etapa 3"),
             ("ok_foto_cel", "Foto conferida no celular (site) e no totem"),
             ("ok_tv", "Aparece na TV do salão"),
             ("ok_lcd", "Aparece na tela LCD (nome curto legível, preço visível)"),
             ("ok_pedido", "Pedido de teste feito e cancelado"),
             ("ok_equipe", "Equipe da cozinha treinada no processo da etapa 4")]
    for i, (n, t) in enumerate(confs):
        caixa_marcar(c, n, M, y + i * 20, t, marcado=v.get(n, False))
    y += len(confs) * 20 + 10
    rotulo(c, "IDs das telas LCD onde aparece (Telas e TV)", M, y)
    campo(c, "telas_ids", M, y + 4, W - 2 * M, valor=v.get("telas_ids", ""))
    y += 40

    secao(c, "Aprovação", y)
    y += 18
    lp = (W - 2 * M - 20) / 3
    for i, (n, t) in enumerate([("apr_nome", "Aprovado por"), ("apr_data", "Data"), ("apr_ass", "Assinatura")]):
        rotulo(c, t, M + i * (lp + 10), y)
        campo(c, n, M + i * (lp + 10), y + 4, lp, altura=22, valor=v.get(n, ""))
    y += 44
    nota(c, M, y, W - 2 * M, "Revisão", (
        "Revise a ficha <b>a cada mudança de fornecedor ou de preço de insumo</b> e pelo menos uma vez por trimestre. "
        "Atualize o preço no sistema e as telas (site, totem, TV e LCD) mudam sozinhas em até 1 minuto."))
    rodape(c, 7)


# ---------------------------------------------------------------- montagem

JS_DOC = r"""
function pzN(n){
  var f=this.getField(n); if(!f) return 0;
  var s=String(f.valueAsString).replace(/[^0-9,.\-]/g,"");
  if(s.indexOf(",")>=0) s=s.replace(/\./g,"").replace(",",".");
  var x=parseFloat(s); return isNaN(x)?0:x;
}
function pzF(x,d){ return x.toFixed(d).replace(".",","); }
"""


def gerar(destino, valores):
    CALCULOS.clear()
    tmp = destino.with_suffix(".tmp.pdf")
    c = canvas.Canvas(str(tmp), pagesize=A4)
    c.setTitle("Ficha técnica do produto — Pizzaria")
    c.setAuthor("Pizzaria")
    c.setSubject("Custo, consumo, processo de produção e imagem do produto")
    for fn in (pagina_capa, pagina_identificacao, pagina_insumos, pagina_custo, pagina_processo, pagina_imagem, pagina_publicacao):
        fn(c, valores)
        c.showPage()
    c.save()

    # Acrescenta os scripts de cálculo e a ordem de cálculo (/CO).
    leitor = PdfReader(str(tmp))
    escritor = PdfWriter()
    escritor.append(leitor)
    por_nome = {}
    for pagina in escritor.pages:
        for anot in pagina.get("/Annots", []) or []:
            obj = anot.get_object()
            nome = obj.get("/T")
            if nome in CALCULOS:
                obj[NameObject("/AA")] = DictionaryObject({
                    NameObject("/C"): DictionaryObject({
                        NameObject("/S"): NameObject("/JavaScript"),
                        NameObject("/JS"): TextStringObject(CALCULOS[nome]),
                    })
                })
                por_nome[nome] = anot
    ordem = [por_nome[n] for n in CALCULOS if n in por_nome]
    acro = escritor._root_object["/AcroForm"]
    acro[NameObject("/CO")] = ArrayObject(ordem)
    acro[NameObject("/NeedAppearances")] = BooleanObject(True)
    # Fonte das caixas de marcar (alguns leitores precisam dela declarada).
    fontes = acro["/DR"]["/Font"]
    fontes[NameObject("/ZaDb")] = escritor._add_object(DictionaryObject({
        NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/ZapfDingbats")}))
    escritor.add_js(JS_DOC)
    with open(destino, "wb") as f:
        escritor.write(f)
    tmp.unlink()
    return len(ordem)


# Exemplo preenchido: Margherita (valores de referência, ajuste aos seus).
def exemplo():
    v = {
        "capa_produto": "Pizza Margherita", "capa_sku": "PZ-001", "capa_data": "v1 · 10/11/2026",
        "nome": "Margherita", "nome_lcd": "Margherita", "categoria": "Pizzas", "responsavel": "Chef da cozinha",
        "data": "10/11/2026", "vende_B": True, "vende_M": True, "vende_G": True,
        "diam_B": "25", "fatias_B": "4", "massa_B": "180", "diam_M": "30", "fatias_M": "6", "massa_M": "250",
        "diam_G": "35", "fatias_G": "8", "massa_G": "330", "meio_a_meio": True,
        "canal_delivery": True, "canal_mesa": True, "canal_totem": True, "canal_tv": True,
        "al_gluten": True, "al_lactose": True, "al_vegetariano": True,
        "imp": "6", "taxa": "3", "margem": "20",
        "fermentacao": "24", "forno_temp": "380", "forno_tempo": "6", "validade_massa": "48",
        "img_arquivo": "margherita-grande.jpg", "img_autor": "Equipe · 10/11/2026",
        "desc_web": "Molho de tomate, mussarela, tomate fresco e manjericão. Contém glúten e lactose.",
        "desc_tv": "Molho de tomate, mussarela, tomate e manjericão",
        "chamada": "Clássica italiana", "telas_ids": "balcao-pizzas, tv-salao",
    }
    for n in ["pc_higiene", "pc_validade", "pc_geladeira", "pc_peso", "pc_conferencia", "pc_lacre"] + \
             ["f_luz", "f_fundo", "f_angulo", "f_real", "f_texto", "f_formato", "f_peso", "f_arquivo"]:
        v[n] = True
    # insumo, unidade, preço pago, qtd embalagem, consumo B/M/G (mesma unidade da compra)
    insumos = [
        ("Farinha de trigo", "kg", 5.20, 1, 0.110, 0.150, 0.200),
        ("Fermento, sal, azeite", "kg", 18.00, 1, 0.006, 0.008, 0.011),
        ("Molho de tomate", "kg", 14.00, 1, 0.070, 0.100, 0.130),
        ("Mussarela", "kg", 42.00, 1, 0.120, 0.180, 0.250),
        ("Tomate fresco", "kg", 8.00, 1, 0.050, 0.070, 0.100),
        ("Manjericão", "un", 4.00, 1, 0.20, 0.30, 0.40),
        ("Orégano", "g", 9.00, 100, 1, 1.5, 2),
        ("Azeite de finalização", "ml", 45.00, 500, 5, 8, 10),
    ]
    tot = {s: 0.0 for s in TAM}
    for k, (n, un, p, q, b, m, g) in enumerate(insumos, start=1):
        cu = p / q
        v.update({f"i_nome_{k}": n, f"i_un_{k}": un, f"i_preco_{k}": f"{p:.2f}".replace(".", ","),
                  f"i_qtd_{k}": str(q).replace(".", ","), f"i_cu_{k}": f"{cu:.4f}".replace(".", ",")})
        for s, val in zip(TAM, (b, m, g)):
            v[f"i_{s.lower()}_{k}"] = (f"{val:.3f}" if val < 1 else f"{val:g}").replace(".", ",")
            tot[s] += cu * val
    fmt = lambda x, d=2: f"{x:.{d}f}".replace(".", ",")
    extras = {"B": (5, 2.80, 0.90, 2.50, 49.0), "M": (5, 3.20, 1.10, 3.00, 69.0), "G": (5, 3.80, 1.30, 3.50, 85.0)}
    for s in TAM:
        perda, emb, gas, mo, preco = extras[s]
        ins = round(tot[s], 2)
        custo = round(ins * (1 + perda / 100) + emb + gas + mo, 2)
        sug = custo / (1 - 0.29)
        lucro = preco - custo - preco * 0.09
        v.update({f"ins_{s}": fmt(ins), f"insumos_{s}": fmt(ins), f"perda_{s}": str(perda), f"emb_{s}": fmt(emb),
                  f"gas_{s}": fmt(gas), f"mo_{s}": fmt(mo), f"custo_{s}": fmt(custo), f"sugerido_{s}": fmt(sug),
                  f"preco_{s}": fmt(preco), f"cmv_{s}": fmt(custo / preco * 100, 1) + " %",
                  f"lucro_{s}": fmt(lucro), f"descmax_{s}": fmt(lucro / preco * 100, 0) + " %"})
    tempos = ["", "2", "1", "2", "6", "1", "2", "1"]
    for k, t in enumerate(tempos, start=1):
        v[f"tempo_{k}"] = t
    v["temp_5"] = "380"
    v["tempo_total"] = str(sum(int(t) for t in tempos if t))
    return v


if __name__ == "__main__":
    n = gerar(AQUI / "ficha-tecnica-produto.pdf", {})
    gerar(AQUI / "ficha-tecnica-produto-exemplo.pdf", exemplo())
    print(f"ok: {n} campos calculados")
