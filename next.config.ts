import type { NextConfig } from "next";
import { assertBuildEnv } from "@/lib/env";

// LIN-60: fail the build early on an invalid/dangerous env (e.g. prod + mock).
assertBuildEnv();

// LIN-56: no `assetPrefix`. Pages live under `app/integration/**` so routes are
// already `/integration/*`; the standalone server serves assets at `/_next/*`.
// An `assetPrefix: '/integration'` made prerendered HTML request `/integration/_next/*`
// while the server only serves `/_next/*` — a 404 trap unless a proxy rewrote it.
// Dropping it makes the image self-consistent. Deployment contract: the LB chain
// must forward BOTH `/integration/*` and `/_next/*` to this service (do not
// path-isolate `/integration/*`). See docs/adr/024.
const nextConfig: NextConfig = {
  devIndicators: false,
  output: 'standalone',
};

export default nextConfig;
