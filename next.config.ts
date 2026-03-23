import type { NextConfig } from "next";
import { APP_BASE_PATH } from './lib/app-paths';

const nextConfig: NextConfig = {
  devIndicators: false,
  basePath: APP_BASE_PATH,
};

export default nextConfig;
