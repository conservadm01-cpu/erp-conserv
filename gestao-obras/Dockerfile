# Imagem de produção (multi-stage).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

FROM node:22-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 1001 app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build --chown=app /app ./
# Pasta de arquivos enviados (monte um volume aqui para persistir).
RUN mkdir -p /app/.data/storage && chown -R app /app/.data
USER app
EXPOSE 3000
# Aplica migrações pendentes e inicia o servidor.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p ${PORT}"]
