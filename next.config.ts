import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bulk resume uploads (ZIPs) can be large; middleware buffers request bodies up to this size.
  experimental: { middlewareClientMaxBodySize: "100mb" },
  serverExternalPackages: ["unpdf", "mammoth", "exceljs"],
};

export default nextConfig;
