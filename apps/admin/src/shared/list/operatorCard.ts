// 一覧の空状態で使う事業者カードの型（Issue #94）。
// features/station と features/line の両方から使われる純粋な型のため、
// どちらか一方の feature に置くと ADR-0001 の feature 間依存ルール
// （line ⇄ station は許可されていない）に抵触する。shared/ に置く。
export type OperatorCard = { id: string; name: string; lineCount: number };
