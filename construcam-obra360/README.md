# Construcam Obra 360 — MVP

Aplicativo web responsivo/PWA para testar gravação audiovisual de reformas usando a câmera do celular.

## O que já está incluído

- Interface responsiva com perfis demonstrativos: profissional, proprietário e administração.
- Pré-visualização da câmera traseira/frontal.
- Gravação pelo navegador com MediaRecorder.
- Áudio desativado.
- **Login** com e-mail e senha ou link por e-mail (Supabase Auth, sem cadastro aberto).
- Divisão da gravação em trechos de 10 segundos, **cada trecho é um arquivo de vídeo completo** que toca sozinho.
- **Fila de envio persistente** (IndexedDB): cada trecho é salvo no aparelho antes de ir para a nuvem. Se a internet cair ou o navegador fechar, o envio continua quando o app for aberto de novo. Dá para começar a gravar até mesmo sem internet.
- Envio dos trechos ao Supabase Storage privado e registro de sessões e trechos no banco.
- **Histórico "Minhas gravações"** com player que encadeia os trechos (links assinados e temporários; o bucket segue privado).
- Pausa de privacidade, tela mantida acesa (Wake Lock) durante a gravação e aviso quando o app sai da tela.
- Esquema SQL inicial e políticas provisórias de segurança.

## Limitações importantes desta versão

1. **Não é ainda um produto pronto para operação comercial.** O login real deve ser configurado no Supabase e as permissões precisam ser ampliadas e auditadas.
2. O painel do proprietário e o painel administrativo são telas de demonstração; não possuem ainda consulta real com autorização por unidade.
3. **Transmissão ao vivo (WebRTC) ainda não está implementada.** Esta versão grava e envia segmentos para a nuvem.
4. Os trechos são arquivos independentes; o player os toca em sequência, com um corte mínimo entre eles. Um arquivo único por gravação (para exportar/baixar) ainda exige montagem no servidor.
5. Navegadores móveis podem suspender gravação em segundo plano, com tela bloqueada ou quando o sistema operacional economiza bateria. Para uso confiável em jornada completa, será necessário um app nativo ou equipamento corporal dedicado.
6. A fila fica no navegador do aparelho: se o usuário limpar os dados do site ou desinstalar o PWA antes do envio, os trechos pendentes se perdem. Se o navegador for encerrado no meio de um trecho, perdem-se no máximo os últimos ~10 segundos.
7. A retenção de 60 dias ainda deve ser implementada por política/rotina de servidor, com exceção para evidências preservadas.
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

Edite `.env.local` com:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No painel Supabase:
1. Execute `supabase/schema.sql` no SQL Editor. (Se você já tinha rodado a versão original, rode apenas `supabase/002_fila_historico.sql`.)
2. Confirme que o bucket `obras-videos` está privado.
3. Em Authentication, habilite o método de login escolhido.
4. Crie usuários de teste (Authentication → Users → Add user). Para o login por link, configure a URL do site em Authentication → URL Configuration.
5. Revise as políticas RLS antes de inserir dados reais.

Depois execute:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Publicação

Pode ser publicado em Vercel ou outro host compatível com Next.js. Configure as duas variáveis de ambiente no serviço de hospedagem e use HTTPS.

## Fluxo de teste

1. No perfil Profissional, entre com um usuário de teste.
2. Preencha os dados da obra, abra a câmera e permita o acesso.
3. Inicie a gravação; o indicador mostra tempo e trechos gravados, e a linha abaixo dos botões mostra a fila de envio.
4. Teste ativar o modo avião no meio da gravação: os trechos ficam guardados e são enviados quando a conexão voltar.
5. Encerre e abra a gravação em "Minhas gravações" para assistir.

## Próximas etapas de desenvolvimento

- Convites e papéis (proprietário, administração) com telas reais.
- Modelo relacional de condomínios, unidades, empresas e membros.
- Autorização do proprietário por unidade.
- WebRTC com LiveKit ou servidor equivalente.
- Montagem de um arquivo único por gravação para exportação.
- Retenção automática de 60 dias e legal hold de evidências.
- Auditoria de acesso, exportação e incidentes.
- Testes reais em Android e iPhone.
