import { db } from '@furatora/database/client';
import { lines, operators, stationLines } from '@furatora/database/schema';
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { escapeLikePattern } from '@/shared/list/params';
import type { ListParams, ListResult } from '@/shared/list/params';
import type { OperatorCard } from '@/shared/list/operatorCard';
import type {
  LineListContext, LineListPageQuery, LineListRow, LineListScope, LineListSort,
} from '@/features/line/ports';

// 路線一覧（#94）。駅一覧（stationListPageQuery.ts）と同じ契約（ListParams / ListResult /
// ADR-0009）に従う。路線一覧に「路線スコープ」は無く、スコープは事業者のみ。
// 事業者カード一覧（getOperatorCards）は stationListPageQuery.ts と同じクエリだが、
// Query Service 間でクエリ本体を共通化しないという ADR-0003 の決定に従い複製する。

function buildWhere(scope: LineListScope, q: string | null): SQL | undefined {
  const conditions: SQL[] = [];
  if (scope.operatorId) conditions.push(eq(lines.operatorId, scope.operatorId));
  if (q) {
    const pattern = `%${escapeLikePattern(q)}%`;
    const textMatch = or(
      ilike(lines.name, pattern),
      ilike(lines.lineCode, pattern),
      ilike(operators.name, pattern),
    );
    if (textMatch) conditions.push(textMatch);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// order=desc で反転させるのは選択中のキーのみ。末尾の lines.id ASC は常に固定する
// （OFFSET ページングの安定性のため）。
function nullsLastOrder(column: AnyColumn, order: 'asc' | 'desc') {
  return order === 'desc' ? sql`${column} DESC NULLS LAST` : sql`${column} ASC NULLS LAST`;
}

function buildOrderBy(sort: LineListSort, order: 'asc' | 'desc') {
  const dir = order === 'desc' ? desc : asc;
  switch (sort) {
    case 'name':
      // collation が C.UTF-8 のため lines.name は五十音順にならない。
      // name_kana は NULL 0件（2026-09-10実測）なのでこちらをキーにする
      return [dir(lines.nameKana), asc(lines.id)];
    case 'lineCode':
      return [nullsLastOrder(lines.lineCode, order), asc(lines.id)];
    case 'operator':
      // operators.name も同じ collation 制約を受けるが、operators に name_kana は無く
      // 既存コード（stationCreatePageQuery 等）も name でソートしている。
      // 本 Issue はこの既存の制約を継承し、新規に解決しない（requirements.md 参照）
      return [dir(operators.name), asc(lines.id)];
    case 'displayOrder':
    default:
      return [nullsLastOrder(lines.displayOrder, order), asc(lines.id)];
  }
}

async function getOperatorOptions() {
  return db.select({ id: operators.id, name: operators.name }).from(operators).orderBy(asc(operators.name));
}

// operatorOptions（全事業者）に既に載っている名前を引き直すだけなので、
// 別クエリは発行しない。
function getScopeLabel(scope: LineListScope, operatorOptions: { id: string; name: string }[]) {
  const operatorName = scope.operatorId
    ? (operatorOptions.find((o) => o.id === scope.operatorId)?.name ?? null)
    : null;
  return { operatorName };
}

// スコープ・検索語が無い空状態のカード一覧。表示順は displayPriority（表示順専用の列。
// docs/domain/station-visibility.md）。
async function getOperatorCards(): Promise<OperatorCard[]> {
  return db
    .select({ id: operators.id, name: operators.name, lineCount: count(lines.id) })
    .from(operators)
    .leftJoin(lines, eq(lines.operatorId, operators.id))
    .groupBy(operators.id, operators.name, operators.displayPriority)
    // displayPriority = 0 は「表示順の指定なし」を表す番兵（NOT NULL DEFAULT 0。
    // docs/domain/station-visibility.md）。素の ASC では 0 が先頭に来てしまうため、
    // 指定なしを末尾へ沈めてから、優先度の昇順・名前順で並べる。
    .orderBy(sql`(${operators.displayPriority} = 0)`, asc(operators.displayPriority), asc(operators.name));
}

async function getListResult(
  scope: LineListScope,
  params: ListParams<LineListSort>,
): Promise<ListResult<LineListRow>> {
  const where = buildWhere(scope, params.q);
  const orderBy = buildOrderBy(params.sort, params.order);
  const offset = (params.page - 1) * params.perPage;

  const rowsQuery = db
    .select({
      id: lines.id, name: lines.name, lineCode: lines.lineCode, color: lines.color,
      operatorName: operators.name,
    })
    .from(lines)
    .innerJoin(operators, eq(lines.operatorId, operators.id));

  const totalQuery = db.select({ total: count() }).from(lines).innerJoin(operators, eq(lines.operatorId, operators.id));

  const [rows, totalRows] = await Promise.all([
    (where ? rowsQuery.where(where) : rowsQuery).orderBy(...orderBy).limit(params.perPage).offset(offset),
    where ? totalQuery.where(where) : totalQuery,
  ]);

  // 駅数はこのページに出る路線ぶんだけ inArray + GROUP BY で畳む
  // （facilityEditPageQuery.ts の畳み込みイディオムを踏襲。602路線全件の集計はしない）
  const stationCounts = rows.length > 0
    ? await db
        .select({ lineId: stationLines.lineId, stationCount: count(stationLines.stationId) })
        .from(stationLines)
        .where(inArray(stationLines.lineId, rows.map((r) => r.id)))
        .groupBy(stationLines.lineId)
    : [];
  const countByLineId = new Map(stationCounts.map((c) => [c.lineId, c.stationCount]));

  return {
    rows: rows.map((row) => ({ ...row, stationCount: countByLineId.get(row.id) ?? 0 })),
    total: totalRows[0]?.total ?? 0,
    page: params.page,
    perPage: params.perPage,
  };
}

export const dbLineListPageQuery: LineListPageQuery = {
  async getListContext(scope, params) {
    // スコープ（事業者）か検索語のいずれかがあるときだけ一覧・件数を発行する。
    // 何も無い空状態では発行しない（受け入れ基準）。
    const showResult = Boolean(scope.operatorId || params.q);

    const [operatorOptions, operatorCards, result] = await Promise.all([
      getOperatorOptions(),
      showResult ? Promise.resolve([]) : getOperatorCards(),
      showResult ? getListResult(scope, params) : Promise.resolve(null),
    ]);

    const context: LineListContext = {
      operators: operatorOptions,
      operatorCards,
      scope: getScopeLabel(scope, operatorOptions),
      result,
    };
    return context;
  },
};
