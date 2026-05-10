import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@qelp/shared"],
  output: "standalone",
  outputFileTracingRoot: process.env.NEXT_OUTPUT_TRACING_ROOT,
};

export default nextConfig;
