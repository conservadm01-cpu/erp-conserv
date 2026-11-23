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
- Histórico com player que encadeia os trechos (links assinados e temporários; o bucket é privado).

## Limitações importantes desta versão

1. **Não é ainda um produto pronto para operação comercial.** As permissões devem passar por auditoria antes de dados reais.
2. **Transmissão ao vivo de verdade (WebRTC) ainda não está implementada.** O "quase ao vivo" toca os trechos à medida que chegam à nuvem.
3. Os trechos são arquivos independentes; um arquivo único por gravação (para exportar/baixar) ainda exige montagem no servidor.
4. Navegadores móveis podem suspender a gravação com a tela bloqueada ou em segundo plano. Para jornada completa confiável, será necessário app nativo ou equipamento dedicado.
5. A fila fica no navegador do aparelho: se os dados do site forem apagados antes do envio, os trechos pendentes se perdem. Se o navegador fechar no meio de um trecho, perdem-se no máximo ~10 segundos.
6. A retenção de 60 dias ainda deve ser implementada por rotina de servidor, com exceção para evidências preservadas.
7. Não há ainda registro (auditoria) de quem assistiu a cada vídeo.
8. O projeto não deve ser usado para gravação clandestina. Exija autorização, aviso aos trabalhadores, pausa de privacidade e avaliação jurídica/LGPD antes de qualquer piloto real.

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

Edite `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Banco de dados (Supabase → SQL Editor)

**Instalação nova:** rode, nesta ordem:
1. `supabase/schema.sql`
2. `supabase/003_condominios_acessos.sql`

**Já tinha rodado a versão original:** rode `supabase/002_fila_historico.sql` e depois `supabase/003_condominios_acessos.sql`. (Os scripts 002 e 003 podem ser executados mais de uma vez.)

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

Pode ser publicado no Vercel ou outro host compatível com Next.js (no Vercel, defina **Root Directory** = `construcam-obra360`). Configure as duas variáveis de ambiente e use HTTPS.

## Fluxo de teste

1. **Administrador da plataforma**: entre, crie um condomínio, cadastre o e-mail do síndico, adicione uma unidade, abra-a, cadastre o proprietário, registre uma obra e dê acesso ao profissional.
2. **Profissional** (outro celular ou janela anônima): entre, escolha a obra e inicie a gravação.
3. **Proprietário**: entre e veja "Gravando agora" com o vídeo quase ao vivo; depois de encerrada, assista no histórico.
4. **Síndico**: veja os números do condomínio e encerre a obra — o profissional deixa de poder gravar nela.
5. Teste o modo avião durante uma gravação: os trechos ficam guardados e são enviados quando a conexão voltar.

## Próximas etapas de desenvolvimento

- Registro de ocorrências pelo proprietário/síndico, com preservação do trecho (legal hold).
- Auditoria de acesso: quem assistiu a qual vídeo e quando.
- Retenção automática de 60 dias.
- Aviso/termo de ciência do profissional antes da primeira gravação.
- WebRTC com LiveKit ou equivalente para ao vivo real.
- Montagem de um arquivo único por gravação para exportação.
- Testes reais em Android e iPhone.
