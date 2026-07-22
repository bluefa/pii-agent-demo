import type { NextConfig } from "next";
import { assertBuildEnv } from "@/lib/env";

// LIN-60: fail the build early on an invalid/dangerous env (e.g. prod + mock).
assertBuildEnv();

// LIN-56: `basePath` mounts the whole app under `/pass` from config —
// routes, API route handlers, and `/_next/*` assets are all served under the
// prefix by the standalone server itself (no proxy rewrite, no `assetPrefix`
// 404 trap). Pages are un-nested to `app/**` so the folder tree does not
// double-encode the prefix. `next/link`, `router`, `redirect`, and
// `usePathname` are basePath-aware (they add/strip it); raw `fetch`/`<iframe
// src>` are not, so those paths keep the literal `/pass`. See docs/adr/024.
const nextConfig: NextConfig = {
  devIndicators: false,
  output: 'standalone',
  basePath: '/pass',
};

export default nextConfig;
