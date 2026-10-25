import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  turbopack: {
    root: path.join(__dirname),
  },
  serverExternalPackages: ["pg"],
};

export default nextConfig;
