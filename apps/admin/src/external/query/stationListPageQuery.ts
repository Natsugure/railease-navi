import { db } from '@furatora/database/client';
import { lines, operators, stationLines, stations } from '@furatora/database/schema';
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { escapeLikePattern } from '@/shared/list/params';
import type { ListParams, ListResult } from '@/shared/list/params';
import type { OperatorCard } from '@/shared/list/operatorCard';
import type {
  StationListContext, StationListPageQuery, StationListRow, StationListScope, StationListSort,
} from '@/features/station/ports';

// 駅一覧（#94）。事業者スコープ化・検索・並び替え・ページングはすべて SQL 側で行い、
// スコープも検索語も無いときは一覧・件数のクエリを発行しない（ADR-0009）。
// admin 全体の Query Service 化は #48。この Query Service が #94 の URL 状態方式の
// 契約（ListParams / ListResult）を最初に実装するもので、路線一覧（lineListPageQuery.ts）
// もこれに揃える。

function buildWhere(scope: StationListScope, q: string | null): SQL | undefined {
  const conditions: SQL[] = [];
  if (scope.operatorId) conditions.push(eq(lines.operatorId, scope.operatorId));
  if (scope.lineId) conditions.push(eq(stationLines.lineId, scope.lineId));
  if (q) {
    const pattern = `%${escapeLikePattern(q)}%`;
    const textMatch = or(
      ilike(stations.name, pattern),
      ilike(stations.nameEn, pattern),
      ilike(stations.code, pattern),
    );
    if (textMatch) conditions.push(textMatch);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// 並び替えキーは画面固有の文字列 union（StationListSort）で受け、ここでだけ SQL の
// 列参照・asc()/desc() に変換する（ADR-0009 / ADR-0003）。
// order=desc で反転させるのは選択中のキーのみ。フォールバックの並び順と末尾の
// stations.id ASC は常に固定する（OFFSET ページングの安定性のため）。
function buildOrderBy(sort: StationListSort, order: 'asc' | 'desc') {
  const dir = order === 'desc' ? desc : asc;
  switch (sort) {
    case 'name':
      // collation が C.UTF-8 のため stations.name は五十音順にならない。
      // name_kana は NULL 0件（2026-09-10実測）なのでこちらをキーにする
      return [dir(stations.nameKana), asc(stations.id)];
    case 'code':
      return [
        order === 'desc' ? sql`${stations.code} DESC NULLS LAST` : sql`${stations.code} ASC NULLS LAST`,
        asc(stations.id),
      ];
    case 'published':
      return [
        order === 'desc'
          ? sql`${stations.publishedAt} DESC NULLS LAST`
          : sql`${stations.publishedAt} ASC NULLS LAST`,
        asc(stations.id),
      ];
    case 'line':
    default:
      // station_lines.station_order は 97%（2026-09-10実測）が NULL のため、
      // 路線内の駅順は ekidata_station_cd で補う（docs/domain/station-master-model.md）
      return [
        dir(lines.displayOrder),
        sql`${stationLines.stationOrder} ASC NULLS LAST`,
        sql`${stations.ekidataStationCd} ASC NULLS LAST`,
        asc(stations.id),
      ];
  }
}

async function getOperatorOptions() {
  return db.select({ id: operators.id, name: operators.name }).from(operators).orderBy(asc(operators.name));
}

async function getLineOptionsForOperator(operatorId: string) {
  return db
    .select({ id: lines.id, name: lines.name, operatorId: lines.operatorId })
    .from(lines)
    .where(eq(lines.operatorId, operatorId))
    .orderBy(asc(lines.displayOrder));
}

async function getScopeLabel(scope: StationListScope) {
  const [operatorRow, lineRow] = await Promise.all([
    scope.operatorId
      ? db.select({ name: operators.name }).from(operators).where(eq(operators.id, scope.operatorId)).limit(1)
      : Promise.resolve([]),
    scope.lineId
      ? db.select({ name: lines.name, color: lines.color }).from(lines).where(eq(lines.id, scope.lineId)).limit(1)
      : Promise.resolve([]),
  ]);
  return {
    operatorName: operatorRow[0]?.name ?? null,
    lineName: lineRow[0]?.name ?? null,
    lineColor: lineRow[0]?.color ?? null,
  };
}

// スコープ・検索語が無い空状態のカード一覧。表示順は displayPriority（表示順専用の列。
// docs/domain/station-visibility.md）。162事業者ぶんを一度に返すが、選択肢用の
// 集計行のみで駅本体は返さないため、一覧クエリ（result: null のとき）とは別枠。
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
  scope: StationListScope,
  params: ListParams<StationListSort>,
): Promise<ListResult<StationListRow>> {
  const where = buildWhere(scope, params.q);
  const orderBy = buildOrderBy(params.sort, params.order);
  const offset = (params.page - 1) * params.perPage;

  const rowsQuery = db
    .select({
      id: stations.id,
      name: stations.name,
      nameEn: stations.nameEn,
      code: stations.code,
      publishedAt: stations.publishedAt,
      stationOrder: stationLines.stationOrder,
      lineId: lines.id,
      lineName: lines.name,
      lineColor: lines.color,
      operatorName: operators.name,
    })
    .from(stationLines)
    .innerJoin(stations, eq(stationLines.stationId, stations.id))
    .innerJoin(lines, eq(stationLines.lineId, lines.id))
    .innerJoin(operators, eq(lines.operatorId, operators.id));

  const totalQuery = db
    .select({ total: count() })
    .from(stationLines)
    .innerJoin(stations, eq(stationLines.stationId, stations.id))
    .innerJoin(lines, eq(stationLines.lineId, lines.id));

  const [rows, totalRows] = await Promise.all([
    (where ? rowsQuery.where(where) : rowsQuery).orderBy(...orderBy).limit(params.perPage).offset(offset),
    where ? totalQuery.where(where) : totalQuery,
  ]);

  return {
    rows: rows.map((row) => ({ ...row, publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null })),
    total: totalRows[0]?.total ?? 0,
    page: params.page,
    perPage: params.perPage,
  };
}

export const dbStationListPageQuery: StationListPageQuery = {
  async getListContext(scope, params) {
    // スコープ（事業者・路線）か検索語のいずれかがあるときだけ一覧・件数を発行する。
    // 何も無い空状態では発行しない（受け入れ基準）。
    const showResult = Boolean(scope.operatorId || scope.lineId || params.q);

    const [operatorOptions, lineOptions, scopeLabel, operatorCards, result] = await Promise.all([
      getOperatorOptions(),
      scope.operatorId ? getLineOptionsForOperator(scope.operatorId) : Promise.resolve([]),
      getScopeLabel(scope),
      showResult ? Promise.resolve([]) : getOperatorCards(),
      showResult ? getListResult(scope, params) : Promise.resolve(null),
    ]);

    const context: StationListContext = {
      operators: operatorOptions,
      operatorCards,
      lines: lineOptions,
      scope: scopeLabel,
      result,
    };
    return context;
  },
};
