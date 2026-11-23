# Construcam Obra 360 — MVP

Aplicativo web responsivo/PWA para testar gravação audiovisual de reformas usando a câmera do celular.

## O que já está incluído

- Interface responsiva com perfis demonstrativos: profissional, proprietário e administração.
- Pré-visualização da câmera traseira/frontal.
- Gravação pelo navegador com MediaRecorder.
- Áudio desativado.
- Divisão da gravação em segmentos de 10 segundos.
- Envio dos segmentos ao Supabase Storage privado.
- Registro de sessões e segmentos no Supabase.
- Esquema SQL inicial e políticas provisórias de segurança.

## Limitações importantes desta versão

1. **Não é ainda um produto pronto para operação comercial.** O login real deve ser configurado no Supabase e as permissões precisam ser ampliadas e auditadas.
2. O painel do proprietário e o painel administrativo são telas de demonstração; não possuem ainda consulta real com autorização por unidade.
3. **Transmissão ao vivo (WebRTC) ainda não está implementada.** Esta versão grava e envia segmentos para a nuvem.
4. Segmentos MediaRecorder com WebM podem depender do segmento inicial para formar um vídeo reproduzível. A reprodução contínua exige montagem/concatenação no servidor ou pipeline de mídia.
5. Navegadores móveis podem suspender gravação em segundo plano, com tela bloqueada ou quando o sistema operacional economiza bateria. Para uso confiável em jornada completa, será necessário um app nativo ou equipamento corporal dedicado.
6. A fila de upload deste MVP não é persistente entre reinicializações e não garante recuperação de segmentos não enviados após queda de conexão.
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
1. Execute `supabase/schema.sql` no SQL Editor.
2. Confirme que o bucket `obras-videos` está privado.
3. Em Authentication, habilite o método de login escolhido.
4. Crie usuários de teste.
5. Revise as políticas RLS antes de inserir dados reais.

Depois execute:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Publicação

Pode ser publicado em Vercel ou outro host compatível com Next.js. Configure as duas variáveis de ambiente no serviço de hospedagem e use HTTPS.

## Fluxo de teste

1. Faça login (a autenticação real deve ser adicionada à tela antes do uso).
2. Selecione o perfil Profissional.
3. Preencha os dados demonstrativos.
4. Abra a câmera e permita o acesso.
5. Inicie a gravação.
6. Para enviar à nuvem, é obrigatório ter sessão autenticada e Supabase configurado.
7. Encerre a gravação e confira os objetos no bucket privado.

## Próximas etapas de desenvolvimento

- Tela de login e convites por papel.
- Modelo relacional de condomínios, unidades, empresas e membros.
- Autorização do proprietário por unidade.
- WebRTC com LiveKit ou servidor equivalente.
- Pipeline de montagem de segmentos e player histórico.
- Fila offline persistente e retomada de upload.
- Retenção automática de 60 dias e legal hold de evidências.
- Auditoria de acesso, exportação e incidentes.
- Testes reais em Android e iPhone.
