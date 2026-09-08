import { db } from '@furatora/database/client';
import { withTransaction, type Tx } from '@furatora/database/tx';
import {
  platformLocations,
  platformLocationCells,
  stationFacilities,
  facilityConnections,
} from '@furatora/database/schema';
import { eq, inArray } from 'drizzle-orm';
import type { PlatformLocationInput } from '@/features/facility/schema';
import type { PlatformLocationRepository, PlatformLocationRecord } from '@/features/facility/ports';
import { requireInserted } from '@/external/requireInserted';

// platformLocations → platformLocationCells → stationFacilities / facilityConnections
// の複数テーブルにまたがる書き込みのため withTransaction で原子化する（ADR-0005）。

async function insertCellsAndFacilities(
  tx: Tx,
  platformLocationId: string,
  cells: PlatformLocationInput['cells']
) {
  for (const cell of cells) {
    const insertedCell = requireInserted(
      await tx
        .insert(platformLocationCells)
        .values({
          platformLocationId,
          xPositionMeters: cell.xPositionMeters != null ? String(cell.xPositionMeters) : null,
        })
        .returning()
    );

    if (cell.facilities.length > 0) {
      await tx.insert(stationFacilities).values(
        cell.facilities.map((f) => ({
          platformLocationCellId: insertedCell.id,
          typeCode: f.typeCode,
          isWheelchairAccessible: f.isWheelchairAccessible ?? true,
          isStrollerAccessible: f.isStrollerAccessible ?? true,
          notes: f.notes ?? null,
        }))
      );
    }
  }
}

async function insertConnections(
  tx: Tx,
  platformLocationId: string,
  connections: PlatformLocationInput['connections']
) {
  if (!connections || connections.length === 0) return;
  await tx.insert(facilityConnections).values(
    connections.map((c) => ({
      platformLocationId,
      connectedStationId: c.stationId,
      connectedPlatformId: c.connectedPlatformId ?? null,
      directionId: c.directionId ?? null,
      exitLabel: c.exitLabel ?? null,
      xRangeStart: c.xRangeStart != null ? String(c.xRangeStart) : null,
      xRangeEnd: c.xRangeEnd != null ? String(c.xRangeEnd) : null,
    }))
  );
}

export const dbPlatformLocationRepository: PlatformLocationRepository = {
  async create(input) {
    return withTransaction(async (tx) => {
      const location = requireInserted(
        await tx
          .insert(platformLocations)
          .values({
            platformId: input.platformId,
            exits: input.exits ?? null,
            notes: input.notes ?? null,
          })
          .returning()
      );

      await insertCellsAndFacilities(tx, location.id, input.cells);
      await insertConnections(tx, location.id, input.connections);

      return location as PlatformLocationRecord;
    });
  },

  async update(id, input) {
    return withTransaction(async (tx) => {
      const [updated] = await tx
        .update(platformLocations)
        .set({
          platformId: input.platformId,
          exits: input.exits ?? null,
          notes: input.notes ?? null,
        })
        .where(eq(platformLocations.id, id))
        .returning();

      if (!updated) return null;

      // アクセス点を再登録（既存削除→再挿入。stationFacilities は CASCADE で削除）
      const existingCells = await tx
        .select({ id: platformLocationCells.id })
        .from(platformLocationCells)
        .where(eq(platformLocationCells.platformLocationId, id));

      if (existingCells.length > 0) {
        await tx.delete(stationFacilities).where(
          inArray(stationFacilities.platformLocationCellId, existingCells.map((c) => c.id))
        );
      }
      await tx.delete(platformLocationCells).where(eq(platformLocationCells.platformLocationId, id));
      await insertCellsAndFacilities(tx, id, input.cells);

      // 乗換駅接続を再登録（既存削除→再挿入）
      await tx.delete(facilityConnections).where(eq(facilityConnections.platformLocationId, id));
      await insertConnections(tx, id, input.connections);

      return updated as PlatformLocationRecord;
    });
  },

  async delete(id) {
    // 子テーブルは CASCADE で削除されるため、単一の DELETE 文で原子的に完結する
    const [row] = await db.delete(platformLocations).where(eq(platformLocations.id, id)).returning();
    return !!row;
  },

  async duplicate(id) {
    const [original] = await db.select().from(platformLocations).where(eq(platformLocations.id, id));
    if (!original) return null;

    const originalCells = await db
      .select()
      .from(platformLocationCells)
      .where(eq(platformLocationCells.platformLocationId, id));

    const originalFacilities = originalCells.length > 0
      ? await db
          .select()
          .from(stationFacilities)
          .where(inArray(stationFacilities.platformLocationCellId, originalCells.map((c) => c.id)))
      : [];

    const originalConnections = await db
      .select()
      .from(facilityConnections)
      .where(eq(facilityConnections.platformLocationId, id));

    return withTransaction(async (tx) => {
      const duplicated = requireInserted(
        await tx
          .insert(platformLocations)
          .values({
            platformId: original.platformId,
            exits: original.exits,
            notes: original.notes,
          })
          .returning()
      );

      for (const cell of originalCells) {
        const duplicatedCell = requireInserted(
          await tx
            .insert(platformLocationCells)
            .values({
              platformLocationId: duplicated.id,
              xPositionMeters: cell.xPositionMeters,
            })
            .returning()
        );

        const cellFacilities = originalFacilities.filter((f) => f.platformLocationCellId === cell.id);
        if (cellFacilities.length > 0) {
          await tx.insert(stationFacilities).values(
            cellFacilities.map((f) => ({
              platformLocationCellId: duplicatedCell.id,
              typeCode: f.typeCode,
              isWheelchairAccessible: f.isWheelchairAccessible,
              isStrollerAccessible: f.isStrollerAccessible,
              notes: f.notes,
            }))
          );
        }
      }

      if (originalConnections.length > 0) {
        await tx.insert(facilityConnections).values(
          originalConnections.map((c) => ({
            platformLocationId: duplicated.id,
            connectedStationId: c.connectedStationId,
            connectedPlatformId: c.connectedPlatformId,
            directionId: c.directionId,
            exitLabel: c.exitLabel,
            xRangeStart: c.xRangeStart,
            xRangeEnd: c.xRangeEnd,
          }))
        );
      }

      return duplicated as PlatformLocationRecord;
    });
  },
};
