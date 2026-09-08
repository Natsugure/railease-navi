import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import base from "./base.mjs";

/**
 * 4層構成の依存ルール（ADR-0001）。
 * パターンはワイルドカードにせず列挙する。`@furatora/database/enums` は
 * 純粋なTypeScript型のみのファイルであり、スキーマ型の漏れとは性質が異なるため
 * 当面の例外として全層で許可する（ADR-0001「@furatora/database/enums の扱い」）。
 */
export default defineConfig([
  ...base,
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/**", "src/shared/**", "src/features/*/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@furatora/database",
                "@furatora/database/client",
                "@furatora/database/schema",
                "drizzle-orm",
              ],
              message: "DBアクセスは external/ に限定してください（ADR-0001）",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/features/*/domain/**",
      "src/features/*/usecases/**",
      "src/features/*/ports.ts",
      "src/external/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*"],
              message: "この層はNext.js非依存を保ってください（ADR-0001）",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
]);
