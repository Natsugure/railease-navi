import { db } from '@furatora/database/client';
import { withTransaction } from '@furatora/database/tx';
import { stationConnections } from '@furatora/database/schema';
import { and, eq, or } from 'drizzle-orm';
import type { StationConnectionRepository } from '@/features/station-connection/ports';

// 乗換接続は有向2行で持つ（docs/domain/station-master-model.md「乗換接続」）。
// createPair は両方向を1トランザクションで冪等に挿入する（ADR-0005）。
export const dbStationConnectionRepository: StationConnectionRepository = {
  async createPair(stationId, input) {
    const { connectedStationId } = input;
    const shared = {
      source: 'manual' as const,
      strollerDifficulty: input.strollerDifficulty ?? null,
      wheelchairDifficulty: input.wheelchairDifficulty ?? null,
      notesAboutStroller: input.notesAboutStroller ?? null,
      notesAboutWheelchair: input.notesAboutWheelchair ?? null,
    };

    await withTransaction(async (tx) => {
      await tx
        .insert(stationConnections)
        .values([
          { stationId, connectedStationId, ...shared },
          { stationId: connectedStationId, connectedStationId: stationId, ...shared },
        ])
        // unique_station_connection(station_id, connected_station_id) を衝突対象にする。
        // 既存の onConflict は seed-master-data.ts の単一カラム target のみで、
        // 複合ユニーク制約を配列で渡すのはリポジトリ初（design.md）。
        .onConflictDoNothing({
          target: [stationConnections.stationId, stationConnections.connectedStationId],
        });
    });
  },

  async deletePair(stationId, connectedStationId) {
    // 単一の DELETE 文で両方向を消す。1文なので原子性は担保され withTransaction は不要。
    const deleted = await db
      .delete(stationConnections)
      .where(
        or(
          and(
            eq(stationConnections.stationId, stationId),
            eq(stationConnections.connectedStationId, connectedStationId),
          ),
          and(
            eq(stationConnections.stationId, connectedStationId),
            eq(stationConnections.connectedStationId, stationId),
          ),
        ),
      )
      .returning({ id: stationConnections.id });
    return deleted.length > 0;
  },
};
