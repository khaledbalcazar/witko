import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin esto Next sube por el arbol buscando lockfiles y elige la carpeta del
  // usuario como raiz del workspace.
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
};

export default nextConfig;
