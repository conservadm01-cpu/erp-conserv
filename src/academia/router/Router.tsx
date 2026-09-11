// =====================================================================
// Roteador por hash (#/caminho)
// ---------------------------------------------------------------------
// Hash permite links diretos e QR Code funcionando em qualquer
// hospedagem estática, sem precisar de regra de rewrite no servidor —
// importante para o link de validação de certificado.
// =====================================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface RouteLocation {
  path: string;
  query: URLSearchParams;
  hash: string;
}

interface RouterValue extends RouteLocation {
  navigate: (to: string, options?: { replace?: boolean }) => void;
  back: () => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function readLocation(): RouteLocation {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart] = raw.split("?");
  return {
    path: pathPart.startsWith("/") ? pathPart : `/${pathPart}`,
    query: new URLSearchParams(queryPart ?? ""),
    hash: raw,
  };
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<RouteLocation>(() => readLocation());

  useEffect(() => {
    const onChange = () => setLocation(readLocation());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const target = to.startsWith("/") ? to : `/${to}`;
    if (options?.replace) {
      const url = `${window.location.pathname}${window.location.search}#${target}`;
      window.history.replaceState(null, "", url);
      setLocation(readLocation());
    } else if (`#${target}` !== window.location.hash) {
      window.location.hash = target;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const back = useCallback(() => window.history.back(), []);

  const value = useMemo<RouterValue>(() => ({ ...location, navigate, back }), [location, navigate, back]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error("useRouter precisa estar dentro de <RouterProvider>");
  return value;
}

/** Compara um padrão (/curso/:courseId/aula/:lessonId) com o caminho atual. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  const wildcard = patternParts[patternParts.length - 1] === "*";
  if (!wildcard && patternParts.length !== pathParts.length) return null;
  if (wildcard && pathParts.length < patternParts.length - 1) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const segment = patternParts[i];
    if (segment === "*") {
      params["*"] = pathParts.slice(i).join("/");
      return params;
    }
    const value = pathParts[i];
    if (segment.startsWith(":")) {
      if (!value) return null;
      params[segment.slice(1)] = decodeURIComponent(value);
    } else if (segment !== value) {
      return null;
    }
  }
  return params;
}

export interface RouteDefinition {
  pattern: string;
  render: (params: Record<string, string>) => React.ReactNode;
  /** Rotas públicas não exigem login (ex.: validação de certificado). */
  public?: boolean;
  /** Rotas administrativas exigem permissão. */
  admin?: boolean;
}

export function resolveRoute(routes: RouteDefinition[], path: string): { route: RouteDefinition; params: Record<string, string> } | null {
  for (const route of routes) {
    const params = matchPath(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}

export function Link({
  to, children, className, onClick, ...rest
}: { to: string; children: React.ReactNode; className?: string; onClick?: () => void } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  const { navigate } = useRouter();
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
