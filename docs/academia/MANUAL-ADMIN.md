# Academia ConServ — Manual do administrador

Guia prático de quem alimenta a plataforma. Nenhuma etapa aqui exige
programação.

---

## 1. Entrar

`https://seu-endereco/academia.html`

Perfis de demonstração (senha `1234`) — troque no primeiro uso real:

| Login | Pessoa | Papel |
|---|---|---|
| `admin` | Coordenação de Treinamento | ADMIN |
| `patricia` | Patrícia (supervisão) | GESTOR |
| `sebastiao` | Sebastião (manutenção) | INSTRUTOR |
| `maria`, `joana`, `antonio` | produção | COLABORADOR |

---

## 2. Adicionar um material novo (o caminho principal)

**Admin → Conteúdos → [+ Novo conteúdo]**

1. **Título** — como as pessoas vão reconhecer o material.
2. **Tipo / categoria / nível / setor** — organiza e direciona.
3. **Material de origem** — uma das três formas:
   - enviar arquivo (PDF, DOCX, PPTX, TXT, imagem, vídeo);
   - informar uma URL e clicar em *Buscar texto*;
   - colar o texto direto.
   > PDF digitalizado (foto de papel), imagem e vídeo não têm texto para
   > analisar. Nesses casos, cole o conteúdo ou a transcrição — a
   > plataforma avisa quando isso é necessário.
4. **Descrição e palavras-chave** — ajudam na busca e nas recomendações.
5. **Fontes e competências** — vincule a fonte oficial (MTE, SENAI,
   fabricante, POP interno). Isso é o que garante rastreabilidade.
6. **[ANALISAR CONTEÚDO]**

Em segundos aparece a tela **Conteúdo identificado**: conceitos,
competências, assuntos, questões possíveis, desafios, jogos sugeridos,
aulas, curiosidades, riscos e procedimentos — com avisos do que precisa de
atenção humana.

---

## 3. Revisar e aprovar

Cada aba traz sugestões para você aprovar **item a item**:

| Aba | O que fazer |
|---|---|
| **Aulas** | pré-visualize o texto (é o material original, com fonte) |
| **Questões** | confira enunciado e alternativas; as marcadas *revisar* nasceram de interpretação |
| **Curiosidades** | publique as que fizerem sentido para a fábrica |
| **Desafios** | confirme se a conduta descrita é mesmo o padrão da casa |
| **Jogos** | publique as rodadas geradas |
| **Ver conteúdo** | os trechos extraídos, cada um com seu SOURCE_ID |
| **Já publicado** | o que aquele material já gerou |
| **Versões** | histórico: quem mudou, quando, o quê e por quê |

Botões de apoio: **Gerar quiz**, **Gerar jogos**, **Gerar apostila**,
**Gerar curso**, **Aprovar e publicar**, **Rejeitar** (com motivo).

> Nada gerado automaticamente entra no ar sozinho. A publicação é sempre
> uma decisão sua.

---

## 4. Transformar em curso

Na tela do conteúdo → **Gerar curso**: escolha título, carga horária,
aulas por módulo e a trilha. O curso nasce com as aulas aprovadas e uma
avaliação final montada com as questões aprovadas.

Depois, em **Admin → Cursos**, você edita dados, nota mínima,
classificação do certificado e publica.

---

## 5. Gerar apostila

**Admin → Apostilas** (ou pelo curso/conteúdo): escolha o curso, autor,
versão e se inclui gabarito. A apostila sai com capa, sumário, objetivos,
módulos, conteúdo, imagens, exemplos, curiosidades, atividades, desafios,
quiz, avaliação, gabarito, referências e conclusão.

Para PDF: abra a apostila e use **Imprimir / salvar PDF** (o layout de
impressão já está preparado).

---

## 6. Trilhas

**Admin → Trilhas**: crie, ordene, marque como obrigatória, escolha quais
cursos fazem parte e para quais funções é recomendada. Trilha sem curso
aparece para o colaborador como "em construção".

---

## 7. Pessoas e competências

**Admin → Colaboradores → [pessoa]**:

- matricular em um curso;
- ver progresso, notas, certificados e XP;
- **avaliar competência** (a avaliação do gestor prevalece sobre o cálculo
  automático);
- ver as lacunas em relação ao alvo da função e matricular no curso que
  resolve.

---

## 8. Riscos reportados

**Admin → Riscos reportados**: cada registro feito pelo botão
🚨 *Eu vi um risco* aparece aqui com foto, setor, local e prioridade.
Fluxo: `aberto → em análise → ação definida → resolvido → encerrado`.
Registre o plano de ação (o quê, quem, até quando). O colaborador que
reportou recebe aviso a cada andamento — inclusive quando o registro é
anônimo (aí o aviso não é enviado, por não haver identificação).

---

## 9. Certificados

**Admin → Certificados**: emissões, consultas de validação e revogação
(com motivo). A validação pública fica em
`/#/validar-certificado/<código>` — é para onde o QR Code aponta.

---

## 10. Configurações

- **Geral** — marca, nota mínima padrão, responsável e classificação do
  certificado, aviso legal.
- **Gamificação** — XP por atividade, níveis, ranking (opcional).
- **IA** — quantidades, nível, tom, público, mistura de dificuldade e o
  endpoint da IA externa (opcional; sem ele a análise roda local).
- **ERP ConServ** — integração futura (produção, máquinas, qualidade).
- **Dados** — onde está gravado e *Restaurar demonstração* (apaga tudo da
  Academia e recria a carga inicial; use só em teste).

---

## 11. Quando algo não sai como esperado

| Situação | O que fazer |
|---|---|
| "O arquivo não tem texto" | cole o conteúdo no campo de texto |
| "Não foi possível ler a página" | a página bloqueia leitura externa (CORS); cole o texto e mantenha a URL como fonte |
| Poucas questões geradas | o material é curto ou pouco estruturado; envie a versão completa ou aumente a quantidade em Configurações → IA |
| Jogo de observação não sugerido | esse tipo precisa de cena desenhada; use os outros tipos ou peça a cena ao time técnico |
| Questão estranha | não aprove: ela só existe como sugestão até você aprovar |
