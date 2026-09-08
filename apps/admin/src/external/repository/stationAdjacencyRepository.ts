import { db } from '@furatora/database/client';
import { stationAdjacencies, stationLines } from '@furatora/database/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
  AdjacencyEndpointNotOnLineError,
  type StationAdjacencyRepository,
} from '@/features/station-adjacency/ports';
import { normalizeAdjacencyEndpoints } from '@/features/station-adjacency/domain/normalize';

// stationAdjacencies は単一テーブル。検証 SELECT と INSERT の間の競合は
// onConflictDoNothing が吸収するため withTransaction は使わない（ADR-0005）。
export const dbStationAdjacencyRepository: StationAdjacencyRepository = {
  async create(lineId, aId, bId) {
    // 両端点がこの路線に属していることを確認する（stationLines に行があるか）。
    const onLine = await db
      .select({ stationId: stationLines.stationId })
      .from(stationLines)
      .where(and(eq(stationLines.lineId, lineId), inArray(stationLines.stationId, [aId, bId])));
    const ids = new Set(onLine.map((r) => r.stationId));
    if (!ids.has(aId) || !ids.has(bId)) {
      throw new AdjacencyEndpointNotOnLineError();
    }

    const { stationAId, stationBId } = normalizeAdjacencyEndpoints(aId, bId);
    await db
      .insert(stationAdjacencies)
      .values({ lineId, stationAId, stationBId })
      .onConflictDoNothing({
        target: [
          stationAdjacencies.lineId,
          stationAdjacencies.stationAId,
          stationAdjacencies.stationBId,
        ],
      });
  },

  async delete(lineId, adjacencyId) {
    const deleted = await db
      .delete(stationAdjacencies)
      .where(and(eq(stationAdjacencies.id, adjacencyId), eq(stationAdjacencies.lineId, lineId)))
      .returning({ id: stationAdjacencies.id });
    return deleted.length > 0;
  },
};
