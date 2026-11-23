# Construcam Obra 360 — MVP

Aplicativo web responsivo/PWA para gravação audiovisual de reformas em condomínios usando a câmera do celular, com acompanhamento pelo proprietário e gestão pela administração do condomínio.

## O que já está incluído

**Acesso por papel (tudo por e-mail)**
- **Administrador da plataforma**: cria condomínios e enxerga todos.
- **Administração do condomínio** (síndico/administradora): cadastra unidades e obras, dá e tira acesso de proprietários, profissionais e outros administradores, encerra/reabre obras e assiste às gravações do condomínio.
- **Proprietário**: vê as obras da(s) sua(s) unidade(s), acompanha a gravação em andamento **quase ao vivo** (atraso de ~10–30 s) e assiste ao histórico.
- **Profissional**: grava somente nas obras **ativas** às quais foi vinculado; vê só as próprias gravações.
- Quem entra sem vínculo vê "Acesso ainda não liberado". As abas aparecem conforme os papéis da pessoa.
- As permissões são garantidas no banco (RLS do Supabase), não apenas na tela — inclusive para os vídeos no Storage.

**Gravação**
- Login com e-mail e senha ou link por e-mail.
- Câmera traseira/frontal, áudio desativado, pausa de privacidade, tela mantida acesa (Wake Lock).
- Trechos de 10 segundos, **cada um é um arquivo de vídeo completo**.
- **Fila de envio persistente** (IndexedDB): cada trecho é salvo no aparelho antes de ir para a nuvem; se a internet cair ou o navegador fechar, o envio continua quando o app for aberto de novo.
- Histórico com player que encadeia os trechos.

**Proteção e transparência**
- **Termo de ciência**: o profissional só consegue gravar depois de aceitar o termo (exigido pelo banco). A administração vê quem já aceitou. *O texto é um modelo — revise com assessoria jurídica.*
- **Ocorrências**: proprietário ou administração marcam um intervalo de trechos com uma descrição; esses trechos ficam **preservados** (não são apagados pela retenção). Só a administração resolve a ocorrência ou libera a preservação.
- **Registro de acessos**: os links dos vídeos são emitidos apenas pelo servidor do app, que confere a permissão e registra quem assistiu (histórico ou ao vivo). Administração e proprietário veem esse registro. O navegador não consegue mais gerar links direto no Storage.
- **Retenção de 60 dias**: rotina diária apaga os trechos com mais de 60 dias, exceto os preservados; a gravação fica marcada como "Expirada".

## Limitações importantes desta versão

1. **Não é ainda um produto pronto para operação comercial.** As permissões devem passar por auditoria antes de dados reais.
2. **Transmissão ao vivo de verdade (WebRTC) ainda não está implementada.** O "quase ao vivo" toca os trechos à medida que chegam à nuvem.
3. Os trechos são arquivos independentes; um arquivo único por gravação (para exportar/baixar) ainda exige montagem no servidor.
4. Navegadores móveis podem suspender a gravação com a tela bloqueada ou em segundo plano. Para jornada completa confiável, será necessário app nativo ou equipamento dedicado.
5. A fila fica no navegador do aparelho: se os dados do site forem apagados antes do envio, os trechos pendentes se perdem. Se o navegador fechar no meio de um trecho, perdem-se no máximo ~10 segundos.
6. O registro de acessos marca quando o link do vídeo foi emitido (não quanto tempo a pessoa assistiu). O link vale 10 minutos.
7. O projeto não deve ser usado para gravação clandestina. Exija autorização, aviso aos trabalhadores, pausa de privacidade e avaliação jurídica/LGPD antes de qualquer piloto real.

## Requisitos

- Node.js 20 ou superior
- Projeto Supabase
- Navegador com suporte a `getUserMedia` e `MediaRecorder`
- HTTPS para acesso à câmera (localhost também é permitido para desenvolvimento)

## Instalação

```bash
npm install
cp .env.example .env.local
```

Edite `.env.local`:

| Variável | Onde achar | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem, chave `anon` | pública |
| `SUPABASE_SERVICE_ROLE_KEY` | idem, chave `service_role` | **secreta**, só no servidor; sem ela os vídeos não abrem |
| `CRON_SECRET` | invente um texto longo e aleatório | protege a rotina de retenção |
| `RETENCAO_DIAS` | opcional | padrão 60 |

### Banco de dados (Supabase → SQL Editor)

**Instalação nova:** rode, nesta ordem:
1. `supabase/schema.sql`
2. `supabase/003_condominios_acessos.sql`
3. `supabase/004_termo_ocorrencias_auditoria.sql`

**Já tinha rodado versões anteriores:** rode o que faltar entre `002_fila_historico.sql`, `003_condominios_acessos.sql` e `004_termo_ocorrencias_auditoria.sql`, nesta ordem. (Os scripts 002–004 podem ser executados mais de uma vez.)

Depois, cadastre você como administrador da plataforma:

```sql
insert into public.plataforma_admins (email) values ('seu-email@exemplo.com');
```

Confirme também que o bucket `obras-videos` está **privado**.

### Login (Supabase → Authentication)

- **Providers → Email**: habilitado. Deixe "Allow new users to sign up" ligado para que as pessoas cadastradas pela administração possam fazer o primeiro acesso pelo link por e-mail. Quem criar conta sem ter sido cadastrado não vê nada.
- **URL Configuration**: coloque o endereço do site (ex.: o domínio do Vercel) em *Site URL* e em *Redirect URLs*.
- Para testar com senha, crie usuários em **Users → Add user**.

Depois execute:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Publicação

Pode ser publicado no Vercel ou outro host compatível com Next.js (no Vercel, defina **Root Directory** = `construcam-obra360`). Configure as variáveis de ambiente da tabela acima (a `SUPABASE_SERVICE_ROLE_KEY` **sem** o prefixo `NEXT_PUBLIC_`) e use HTTPS.

A retenção roda todo dia às 06:17 UTC pelo Vercel Cron (`vercel.json`), que envia o `CRON_SECRET` automaticamente. Em outro host, agende uma chamada diária:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://SEU-SITE/api/cron/retencao
```

## Instalar no celular

O app é um PWA: abra o endereço no celular e
- **Android (Chrome):** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*;
- **iPhone (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.

Ele abre em tela cheia, com ícone próprio e barra de abas embaixo. No computador, as abas viram uma barra lateral.

## Versão de demonstração

`npm run demo:build` gera `demo/dist/construcam-demo.html`: um único HTML com as mesmas telas do app, mas com um banco em memória no navegador (mesmas regras de acesso), câmera simulada quando a real não é liberada e um botão **Demo** para trocar de pessoa, simular um profissional gravando ao vivo, avançar 61 dias (retenção) e reiniciar os dados. Serve para testar o fluxo sem Supabase; não envia nada para lugar nenhum.

## Fluxo de teste

1. **Administrador da plataforma**: entre, crie um condomínio, cadastre o e-mail do síndico, adicione uma unidade, abra-a, cadastre o proprietário, registre uma obra e dê acesso ao profissional.
2. **Profissional** (outro celular ou janela anônima): entre, aceite o termo, escolha a obra e inicie a gravação.
3. **Proprietário**: entre e veja "Gravando agora" com o vídeo quase ao vivo; depois de encerrada, assista no histórico e registre uma ocorrência num trecho.
4. **Síndico**: veja o alerta de ocorrência aberta, o "termo aceito" ao lado do profissional e o registro de acessos; resolva a ocorrência e encerre a obra.
5. Teste o modo avião durante uma gravação: os trechos ficam guardados e são enviados quando a conexão voltar.

## Próximas etapas de desenvolvimento

- Exportar os trechos de uma ocorrência (arquivo único para entregar à construtora ou ao jurídico).
- Notificações (e-mail/WhatsApp) para nova ocorrência e início de gravação.
- WebRTC com LiveKit ou equivalente para ao vivo real.
- Montagem de um arquivo único por gravação para exportação.
- Testes reais em Android e iPhone.
