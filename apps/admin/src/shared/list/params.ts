// 一覧（駅・路線）が共通で使う URL パラメータの型と解析（Issue #94）。
// ADR-0009: 一覧の絞り込み・並び替え・ページングはサーバー側で行い、URL クエリを
// 唯一の状態源とする。ここは feature 横断の shared/ に置く（ADR-0001）ため、
// Drizzle も Next.js も import しない。
//
// ソートキーは画面ごとの文字列 union（例: StationListSort）で表す。
// SQL の列参照や asc()/desc() をこの型に持ち込まない。それらへの変換は
// external/query/*.ts の中だけで行う（ADR-0003 が選択肢1を却下した理由への対処）。

import { z } from 'zod';

export type SortOrder = 'asc' | 'desc';

export type ListParams<TSort extends string> = {
  q: string | null;
  sort: TSort;
  order: SortOrder;
  page: number;
  perPage: number;
};

export type ListResult<TRow> = {
  rows: TRow[];
  total: number;
  page: number;
  perPage: number;
};

export type ListParamsSpec<TSort extends string> = {
  sortKeys: readonly TSort[];
  defaultSort: TSort;
  perPage: number;
};

/** searchParams から1つの値を取り出す。配列で来た場合は先頭のみ使う */
export function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const uuidSchema = z.string().uuid();

/**
 * スコープ用の UUID パラメータ（operatorId / lineId 等）を取り出す。
 * 不正な形式（例: `?operatorId=not-a-uuid`）は undefined にフォールバックする。
 * ここで弾かないと、Drizzle が生成する `WHERE id = $1` にそのまま渡り
 * Postgres の `invalid input syntax for type uuid` で 500 になる。
 */
export function parseUuidParam(value: string | string[] | undefined): string | undefined {
  const v = singleParam(value);
  const result = v ? uuidSchema.safeParse(v) : undefined;
  return result?.success ? result.data : undefined;
}

/**
 * searchParams（Next.js の Server Component が受け取る形）を ListParams に変換する。
 * 不正な値・未知の値はすべて既定値へフォールバックする（`stations/new/page.tsx` の
 * `Number.isInteger` 検証パターンの一般化）。500 を返さないことを最優先にする。
 */
export function parseListParams<TSort extends string>(
  raw: Record<string, string | string[] | undefined>,
  spec: ListParamsSpec<TSort>,
): ListParams<TSort> {
  const qRaw = singleParam(raw.q)?.trim();
  const q = qRaw ? qRaw : null;

  const sortRaw = singleParam(raw.sort);
  const sort = spec.sortKeys.includes(sortRaw as TSort) ? (sortRaw as TSort) : spec.defaultSort;

  const orderRaw = singleParam(raw.order);
  const order: SortOrder = orderRaw === 'desc' ? 'desc' : 'asc';

  const pageRaw = singleParam(raw.page);
  const pageParsed = pageRaw === undefined ? NaN : Number(pageRaw);
  const page = Number.isInteger(pageParsed) && pageParsed >= 1 ? pageParsed : 1;

  return { q, sort, order, page, perPage: spec.perPage };
}

/**
 * ILIKE パターン中のワイルドカード（% _）とエスケープ文字自身（\）をエスケープする。
 * Drizzle はバインド値をパラメータ化するため SQL インジェクションは起きないが、
 * ユーザー入力中の `%` `_` はそのままだとワイルドカードとして解釈されてしまう
 * （例: 検索語 `100%` が任意文字列にマッチしてしまう）。
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}
