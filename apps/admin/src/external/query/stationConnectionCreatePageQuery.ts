import { db } from '@furatora/database/client';
import { stations, lines, stationLines, operators } from '@furatora/database/schema';
import { and, asc, eq, ne } from 'drizzle-orm';
import type { StationConnectionCreatePageQuery } from '@/features/station-connection/ports';

// 接続の追加ページの候補駅を、事業者 → 路線で段階的に絞って返す（#88）。
// 全10,625駅を一度に読むクエリは発行しない。#94 の URL 状態方式に揃える。
export const dbStationConnectionCreatePageQuery: StationConnectionCreatePageQuery = {
  async getCreateContext(stationId, scope) {
    // 4クエリは互いに独立なので1度に投げる（scope 未指定ぶんは空配列で埋める）。
    // 不正な stationId の稀ケースで数クエリを捨てるだけ。
    const [station, operatorOptions, lineOptions, candidates] = await Promise.all([
      db.select({ name: stations.name }).from(stations).where(eq(stations.id, stationId)).limit(1),
      db
        .select({ id: operators.id, name: operators.name })
        .from(operators)
        .orderBy(asc(operators.name)),
      scope.operatorId
        ? db
            .select({ id: lines.id, name: lines.name })
            .from(lines)
            .where(eq(lines.operatorId, scope.operatorId))
            .orderBy(asc(lines.displayOrder))
        : Promise.resolve([]),
      scope.lineId
        ? db
            .select({
              id: stations.id,
              name: stations.name,
              code: stations.code,
              lineName: lines.name,
            })
            .from(stationLines)
            .innerJoin(stations, eq(stationLines.stationId, stations.id))
            .innerJoin(lines, eq(stationLines.lineId, lines.id))
            .where(and(eq(stationLines.lineId, scope.lineId), ne(stations.id, stationId)))
            .orderBy(asc(stationLines.stationOrder))
        : Promise.resolve([]),
    ]);

    if (!station[0]) return null;

    return {
      stationName: station[0].name,
      operators: operatorOptions,
      lines: lineOptions,
      candidates,
    };
  },
};
