import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Treat custom hooks that forward their `deps` to useEffect as effect-like,
  // so call sites still get exhaustive-deps validation.
  {
    rules: {
      "react-hooks/exhaustive-deps": [
        "warn",
        { additionalHooks: "(useAbortableEffect)" },
      ],
    },
  },
  // ADR-011 boundary: no @/lib/api-client imports anywhere (deleted).
  // CSR components must use @/app/lib/api/*; routes/server use @/lib/bff/client.
  {
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/lib/api-client", "@/lib/api-client/*"],
            message: "lib/api-client/* was removed in ADR-011. Use @/lib/bff/client (server/route) or @/app/lib/api/* (CSR). See docs/api/boundaries.md.",
          },
        ],
      }],
    },
  },
  {
    files: ["app/components/**/*.{ts,tsx}", "app/integration/**/_components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/lib/bff/*"],
            message: "CSR components must use @/app/lib/api/* — see docs/api/boundaries.md.",
          },
          {
            group: ["@/lib/api-client", "@/lib/api-client/*"],
            message: "lib/api-client/* was removed in ADR-011. Use @/app/lib/api/* (CSR).",
          },
        ],
      }],
    },
  },
  {
    files: ["app/integration/api/v1/**/route.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/app/lib/api/*"],
            message: "Route handlers use @/lib/bff/client — see docs/api/boundaries.md.",
          },
          {
            group: ["@/lib/api-client", "@/lib/api-client/*"],
            message: "lib/api-client/* was removed in ADR-011. Use @/lib/bff/client.",
          },
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
