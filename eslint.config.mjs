import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / vendored artifacts — these are gitignored too but ESLint
    // doesn't read .gitignore. Without these, `npm run lint` drowns in
    // 13k+ pre-existing warnings from minified bundles.
    ".netlify/**",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    // Stale git worktrees keep their own source + .next bundles; without this
    // ESLint re-lints every worktree copy and floods the output.
    ".claude/**",
  ]),
]);

export default eslintConfig;
