import { db } from '@furatora/database/client';
import { withTransaction, type Tx } from '@furatora/database/tx';
import { trainStopPatterns, trainStopPatternCars, platforms } from '@furatora/database/schema';
import { and, eq, exists, sql } from 'drizzle-orm';
import { DuplicateStopPatternError, type StopPatternRepository } from '@/features/stop-pattern/ports';
import { requireInserted } from '@/external/requireInserted';

// PostgreSQL の一意制約違反（unique_violation）のエラーコード。
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION_CODE = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === UNIQUE_VIOLATION_CODE
  );
}

// 書き込み対象のホームが当該駅のものかを検証する。
// これを省くと、A駅の管理画面からB駅のホームにパターンを作成・付け替えできてしまう。
async function isPlatformOfStation(tx: Tx, platformId: string, stationId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: platforms.id })
    .from(platforms)
    .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId)));
  return !!row;
}

// 更新・削除の対象行を当該駅のホームに属するものへ絞り込む相関サブクエリ。
// 「先に SELECT で確認してから UPDATE」ではなく WHERE 句に含めることで、単一文で完結させる。
function belongsToStation(stationId: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(platforms)
      .where(
        and(eq(platforms.id, trainStopPatterns.platformId), eq(platforms.stationId, stationId))
      )
  );
}

// trainStopPatterns.id は DB側で採番されるため「親を insert → 返却された id で子を insert」
// という順序が必須。この形は db.batch() では表現できないため withTransaction を使う（ADR-0005）。
export const dbStopPatternRepository: StopPatternRepository = {
  async save(stationId, pattern) {
    try {
      return await withTransaction(async (tx) => {
        if (!(await isPlatformOfStation(tx, pattern.platformId, stationId))) return false;

        const row = requireInserted(
          await tx
            .insert(trainStopPatterns)
            .values({ platformId: pattern.platformId, trainId: pattern.trainId })
            .returning()
        );
        await tx.insert(trainStopPatternCars).values(
          pattern.cars.map((c) => ({
            trainStopPatternId: row.id,
            carNumber: c.carNumber,
            startMeters: String(c.startMeters),
            endMeters: String(c.endMeters),
          }))
        );
        return true;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DuplicateStopPatternError(
          'このホーム・列車の組み合わせには既に停車位置パターンが登録されています'
        );
      }
      throw err;
    }
  },

  async update(id, stationId, pattern) {
    try {
      return await withTransaction(async (tx) => {
        // 付け替え先ホームが他駅のものであれば、更新対象が当該駅のものでも拒否する
        if (!(await isPlatformOfStation(tx, pattern.platformId, stationId))) return false;

        const [updated] = await tx
          .update(trainStopPatterns)
          .set({ platformId: pattern.platformId, trainId: pattern.trainId })
          .where(and(eq(trainStopPatterns.id, id), belongsToStation(stationId)))
          .returning();
        if (!updated) return false;

        // cars は delete → insert で置き換える（親IDは変わらないため batch でも表現できるが、
        // save() と実装を揃えるため withTransaction 内に統一する）
        await tx.delete(trainStopPatternCars).where(eq(trainStopPatternCars.trainStopPatternId, id));
        await tx.insert(trainStopPatternCars).values(
          pattern.cars.map((c) => ({
            trainStopPatternId: id,
            carNumber: c.carNumber,
            startMeters: String(c.startMeters),
            endMeters: String(c.endMeters),
          }))
        );
        return true;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DuplicateStopPatternError(
          'このホーム・列車の組み合わせには既に停車位置パターンが登録されています'
        );
      }
      throw err;
    }
  },

  async delete(id, stationId) {
    // trainStopPatternCars は CASCADE で削除される
    const [row] = await db
      .delete(trainStopPatterns)
      .where(and(eq(trainStopPatterns.id, id), belongsToStation(stationId)))
      .returning();
    return !!row;
  },
};
