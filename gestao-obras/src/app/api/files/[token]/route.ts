import { authedRoute } from "@/server/http/handler";
import { Errors } from "@/server/http/errors";
import { getStorage } from "@/server/storage/storage";
import { verifyDownloadToken } from "@/server/storage/download-token";

/** Entrega um arquivo privado mediante token temporário emitido para o próprio usuário. */
export const GET = authedRoute<{ token: string }>(async ({ actor, params }) => {
  const payload = verifyDownloadToken(params.token);
  if (!payload || payload.u !== actor.userId) throw Errors.forbidden("Link de download inválido ou expirado. Solicite o download novamente.");
  const bytes = await getStorage().read(payload.k);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": payload.m,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(payload.n)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});
