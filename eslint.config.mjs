import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
// From @eslint/eslintrc's own dependencies (already installed with it).
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  // ESLint 9 (flat config) only lints .js/.mjs/.cjs unless a config names
  // other extensions — the Next preset names none, so every .jsx file was
  // skipped. This entry makes src/**/*.jsx lintable too and catches
  // undefined identifiers (browser + node globals; JSX via the Next parser).
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-undef": "error",
      "react/jsx-no-undef": "error",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
