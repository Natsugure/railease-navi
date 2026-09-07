import { db } from '@furatora/database/client';
import { operators, lines, trains, trainEquipments, trainCarStructures } from '@furatora/database/schema';
import { asc, eq } from 'drizzle-orm';
import type {
  TrainEditPageQuery, TrainEditContext, OperatorOption, TrainLineOption,
} from '@/features/train/ports';

// admin 全体の Query Service 化は #48。ここは #49（フォームのクライアント側 fetch 廃止）で
// 先行導入したもの。src/app/** は ESLint の依存ルールで @furatora/database を直接 import できない。

async function getOperatorOptions(): Promise<OperatorOption[]> {
  return db
    .select({ id: operators.id, name: operators.name })
    .from(operators)
    .orderBy(asc(operators.name));
}

async function getLineOptions(): Promise<TrainLineOption[]> {
  const rows = await db
    .select({
      id: lines.id,
      name: lines.name,
      nameEn: lines.nameEn,
      operatorId: lines.operatorId,
    })
    .from(lines)
    .orderBy(asc(lines.displayOrder));
  return rows.map((r) => ({ ...r, nameEn: r.nameEn ?? '' }));
}

export const dbTrainEditPageQuery: TrainEditPageQuery = {
  async getCreateContext() {
    const [operatorOptions, lineOptions] = await Promise.all([
      getOperatorOptions(),
      getLineOptions(),
    ]);
    return { operators: operatorOptions, lines: lineOptions };
  },

  async getEditContext(trainId) {
    const [train] = await db.select().from(trains).where(eq(trains.id, trainId));
    if (!train) return null;

    const [operatorOptions, lineOptions, equipments, carStructureRows] = await Promise.all([
      getOperatorOptions(),
      getLineOptions(),
      db.select().from(trainEquipments).where(eq(trainEquipments.trainId, trainId)),
      db.select().from(trainCarStructures).where(eq(trainCarStructures.trainId, trainId)),
    ]);

    const context: TrainEditContext = {
      operators: operatorOptions,
      lines: lineOptions,
      train: {
        id: train.id,
        name: train.name,
        // trains テーブルの列名は operators（単一FK）/ lines（uuid配列）
        operatorId: train.operators,
        lineIds: train.lines,
        carCount: train.carCount,
        carStructure: carStructureRows.length > 0
          ? carStructureRows.map((cs) => ({
              carNumber: cs.carNumber,
              doorCount: cs.doorCount,
              carLength: cs.carLength != null ? Number(cs.carLength) : null,
            }))
          : null,
        freeSpaces: equipments
          .filter((e) => e.type === 'free_space')
          .map((e) => ({ carNumber: e.carNumber, nearDoor: e.nearDoor, isStandard: e.isStandard })),
        prioritySeats: equipments
          .filter((e) => e.type === 'priority_seat')
          .map((e) => ({ carNumber: e.carNumber, nearDoor: e.nearDoor, isStandard: e.isStandard })),
      },
    };
    return context;
  },
};
