import path from "node:path";
import type { NextConfig } from "next";

// O repositório tem outro projeto (o ERP) na pasta acima; fixa a raiz deste app.
const nextConfig: NextConfig = { outputFileTracingRoot: path.join(__dirname) };
export default nextConfig;
