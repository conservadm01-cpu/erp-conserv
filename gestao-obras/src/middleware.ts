import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PAGES = ["/login", "/recuperar-acesso", "/redefinir-senha"];
const SESSION_COOKIES = ["go_session", "__Host-go_session"];

function buildCsp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const correlationId = crypto.randomUUID();
  const csp = buildCsp(nonce);

  const isApi = pathname.startsWith("/api/");
  const isPublic = PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasCookie = SESSION_COOKIES.some((c) => req.cookies.has(c));

  // Verificação rápida; a validação real da sessão acontece no servidor.
  if (!isApi && !isPublic && !hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + search)}` : "";
    return NextResponse.redirect(url);
  }

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("x-correlation-id", correlationId);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-correlation-id", correlationId);
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)" }],
};
