// PostgreSQL のエラーコード（SQLSTATE）判定。
// https://www.postgresql.org/docs/current/errcodes-appendix.html
//
// 【err.code だけでなく err.cause.code も見る】
// 実測（rehearsalブランチでの検証）で、drizzle-orm 0.45.1 は withTransaction
// （neon-serverless）経由の失敗を DrizzleQueryError でラップし、実際の pg エラー
// （code: '23505' 等）はトップレベルの `err.code` ではなく `err.cause.code` に入る。
// `err.code` だけを見る判定はラップされたケースを取りこぼす。
//
// packages/database は web / scripts と共有のため、admin 都合のこのヘルパーは
// external/ にローカルで置く（ADR-0001。requireInserted.ts と同じ方針）。
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

function errorCode(err: unknown): unknown {
  return typeof err === 'object' && err !== null && 'code' in err
    ? (err as { code: unknown }).code
    : undefined;
}

export function isPgErrorCode(err: unknown, code: string): boolean {
  if (errorCode(err) === code) return true;
  const cause = typeof err === 'object' && err !== null && 'cause' in err
    ? (err as { cause: unknown }).cause
    : undefined;
  return errorCode(cause) === code;
}
