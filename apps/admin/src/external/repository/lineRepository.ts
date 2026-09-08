import { db } from '@furatora/database/client';
import { lines } from '@furatora/database/schema';
import type { LineRepository } from '@/features/line/ports';
import { requireInserted } from '@/external/requireInserted';

// lines は単一テーブルで、作成時に子テーブルへ波及しない。
// withTransaction は使わず db のままでよい（ADR-0005「単一テーブルの単純な書き込み」）。
//
// slug / ekidataLineCd は設定しない。slug は公開操作の周辺で確定し、
// ekidataLineCd は手動追加行が持ち得ない（ADR-0007 決定3 /
// docs/domain/station-master-model.md）。
export const dbLineRepository: LineRepository = {
  async create(input) {
    const rows = await db
      .insert(lines)
      .values({
        name: input.name,
        operatorId: input.operatorId,
        nameKana: input.nameKana ?? null,
        nameEn: input.nameEn ?? null,
        odptRailwayId: input.odptRailwayId ?? null,
        lineCode: input.lineCode ?? null,
        color: input.color ?? null,
        displayOrder: input.displayOrder ?? 0,
      })
      .returning({ id: lines.id, name: lines.name, operatorId: lines.operatorId });
    return requireInserted(rows);
  },
};
