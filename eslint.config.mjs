import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const EM_DASH = "No em dash in anything a person reads (DESIGN.md): use a comma, colon, full stop or parentheses.";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "src/lib/api/schema.d.ts", "playwright-report/**", "test-results/**"]),
  {
    rules: {
      // Stored HTML is made inert before it is drawn (ADR 0030); nothing draws raw HTML.
      "react/no-danger": "error",
      // Errors go to error tracking, which scrubs them first (ADR 0026); a console line reaches nobody safely.
      "no-console": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "JSXText[value=/\\u2014/]", message: EM_DASH },
        { selector: "Literal[value=/\\u2014/]", message: EM_DASH },
        { selector: "TemplateElement[value.raw=/\\u2014/]", message: EM_DASH },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/server/*"], message: "Server code is for route handlers and server components only; the browser reaches the API through /api/backend." },
          ],
        },
      ],
    },
  },
  {
    // Local tooling outside the app prints to the terminal.
    files: ["scripts/**", "dev/**", "test/**", "*.config.*"],
    rules: { "no-console": "off" },
  },
  {
    // Route handlers, the proxy and server-only modules may use the server helpers, and so may the start
    // flow's pages, which are server components reading the brand's open programs before anything renders.
    files: ["src/app/api/**", "src/proxy.ts", "src/instrumentation.ts", "src/lib/server/**", "test/**", "src/app/(patient)/patient/start/**/page.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
]);
