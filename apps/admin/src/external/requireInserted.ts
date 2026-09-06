// db.insert(...).returning() / db.update(...).returning() は「必ず1行返る」ことが
// 呼び出し側の前提になっている箇所がある。noUncheckedIndexedAccess（Issue #50）下では
// rows[0] が T | undefined になるため、前提を1箇所で表明する。
//
// packages/database は web / scripts と共有のため、admin 都合のこのヘルパーは
// external/ にローカルで置く（ADR-0001）。
export function requireInserted<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error('INSERT/UPDATE ... RETURNING が行を返しませんでした');
  }
  return row;
}
