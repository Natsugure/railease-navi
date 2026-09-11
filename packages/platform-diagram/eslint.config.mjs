import { defineConfig } from 'eslint/config';
import nextTs from 'eslint-config-next/typescript';
import base from '@furatora/eslint-config/base';

// このパッケージは apps/web / apps/admin の両方から使われる Next.js 非依存の
// 純粋な描画パッケージ（ADR-0010）。TypeScript + React の構文解析・型検査ルールは
// next-app.mjs と同じ eslint-config-next/typescript から借りるが（TSパーサ・
// typescript-eslint ルールセットが必要なため）、Next.js アプリではないので
// core-web-vitals（App Router固有ルール）は含めない。next/* への実際の import は
// 下記の no-restricted-imports で機械的に禁止する。
export default defineConfig([
  ...base,
  ...nextTs,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*'],
              message: 'このパッケージは Next.js 非依存を保ってください（ADR-0010）',
            },
            {
              group: ['@furatora/database', '@furatora/database/*', 'drizzle-orm'],
              message: 'このパッケージは DB 非依存を保ってください（ADR-0010）',
            },
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
]);
