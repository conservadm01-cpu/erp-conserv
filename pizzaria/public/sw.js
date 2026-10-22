// Service worker mínimo — existe só para o navegador considerar o app
// instalável (critério de "fixar atalho na área de trabalho"/tela inicial).
// Não faz cache nem funciona offline: cada requisição segue normalmente
// para a rede, então os dados do Supabase continuam sempre atualizados.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
