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
    // Separate HyperFrames video subproject with its own tooling and its own
    // AGENTS.md; its vendored gsap.min.js and render scripts are not app code.
    "launch-video/**",
  ]),
  {
    rules: {
      // Convention: parameters kept for call-site compatibility but unused by the
      // implementation are prefixed with "_". Without this the swap to a
      // design-system-verbatim copy would force needless caller changes.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
