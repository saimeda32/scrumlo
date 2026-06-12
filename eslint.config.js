import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "test-results/", "playwright-report/", ".wrangler/", ".superpowers/", "docs/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "shared/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["worker/**/*.ts"],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.browser } },
  },
  {
    files: ["test/**/*.{ts,mjs}", "scripts/**/*.mjs", "*.config.{js,ts}", "vite.config.ts"],
    // Node 22+: WebSocket is a runtime global the `globals` package doesn't list yet.
    languageOptions: { globals: { ...globals.node, WebSocket: "readonly" } },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The new purity/ref rules flag real pre-existing patterns (socket ref read in
      // render, setState-in-effect). Tracked for the hardening pass — warn, not error,
      // so they stay visible without blocking unrelated work. Core rules stay errors.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    rules: {
      // Steers toward small, flat functions instead of clever nesting.
      complexity: ["warn", 15],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Best-effort cleanup (`try { ws.close() } catch {}`) is a deliberate idiom here.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);
