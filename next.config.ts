import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // libSQL carga binarios nativos: el empaquetador debe dejarlo fuera.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
