import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: 'standalone',
  assetPrefix: '/integration',
};

export default nextConfig;
