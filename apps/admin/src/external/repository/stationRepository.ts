import { withTransaction } from '@furatora/database/tx';
import { stations, stationLines } from '@furatora/database/schema';
import {
  StationReferenceNotFoundError,
  type StationRepository,
} from '@/features/station/ports';
import { requireInserted } from '@/external/requireInserted';

// PostgreSQL の外部キー制約違反（foreign_key_violation）。
// zod で uuid 形式は検証済みだが、存在しない operatorId / lineId / stationGroupId が
// 渡されると DB で 23503 になる。route.ts が 422 に写像できるよう専用エラーに変換する。
//
// 【判定方法】stationPublishingRepository.ts の isUniqueViolation と同じ。
// withTransaction（neon-serverless）経由の失敗は DrizzleQueryError でラップされ、
// 実際の pg エラーコードは err.code ではなく err.cause.code に入る（同ファイルの実測コメント）。
const FOREIGN_KEY_VIOLATION_CODE = '23503';

function getErrorCode(err: unknown): unknown {
  return typeof err === 'object' && err !== null && 'code' in err
    ? (err as { code: unknown }).code
    : undefined;
}

function isForeignKeyViolation(err: unknown): boolean {
  if (getErrorCode(err) === FOREIGN_KEY_VIOLATION_CODE) return true;
  const cause = typeof err === 'object' && err !== null && 'cause' in err
    ? (err as { cause: unknown }).cause
    : undefined;
  return getErrorCode(cause) === FOREIGN_KEY_VIOLATION_CODE;
}

// stations と stationLines の2テーブルへ書くため withTransaction を使う（ADR-0005）。
// stations の id は DB 側で採番されるため、親を INSERT → 返却 id で子を INSERT の順。
export const dbStationRepository: StationRepository = {
  async create(input) {
    try {
      return await withTransaction(async (tx) => {
        const stationRows = await tx
          .insert(stations)
          .values({
            name: input.name,
            operatorId: input.operatorId,
            nameKana: input.nameKana ?? null,
            nameEn: input.nameEn ?? null,
            code: input.code ?? null,
            lat: input.lat ?? null,
            lon: input.lon ?? null,
            odptStationId: input.odptStationId ?? null,
            prefCode: input.prefCode ?? null,
            stationGroupId: input.stationGroupId ?? null,
            // slug / publishedAt / ekidataStationCd は設定しない（NULL）。
            // 公開は /stations/[stationId]/publish で行う（station-visibility.md）。
          })
          .returning({ id: stations.id, name: stations.name });
        const created = requireInserted(stationRows);

        await tx.insert(stationLines).values({
          stationId: created.id,
          lineId: input.lineId,
          stationOrder: input.stationOrder ?? null,
        });

        return created;
      });
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new StationReferenceNotFoundError();
      }
      throw err;
    }
  },
};
