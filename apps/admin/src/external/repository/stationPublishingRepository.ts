import { db } from '@furatora/database/client';
import { withTransaction, type Tx } from '@furatora/database/tx';
import { stations, stationLines, lines } from '@furatora/database/schema';
import { eq, sql } from 'drizzle-orm';
import {
  LineSlugMissingError,
  SlugTakenError,
  type StationPublishingRepository,
} from '@/features/station-publishing/ports';
import { isPgErrorCode, PG_UNIQUE_VIOLATION } from '@/external/pgError';

// slug の一意制約違反（23505）は SlugTakenError に写像し、route.ts が 409 を返す。
// これを取りこぼすと 500 になる。ラップされた cause 展開の詳細は external/pgError.ts。
//
// 【注意】stopPatternRepository.ts の isUniqueViolation は err.code しか見ておらず、
// withTransaction 経由でラップされたケースを取りこぼす。統一は別 Issue。

// 駅が属する路線の slug を読む。stationLines が複数路線を持つ場合（実測5駅）は
// 「slug を持つ路線」を優先して1件返す（slug NULLS LAST、同順位は lines.id で確定）。
// これは「所属路線のいずれかが slug を持てば公開できる」という公開ゲートの
// 意図に合わせたもの。可視性（visibleLine）は apps/web 側で路線ごとに個別判定される。
//
// stationPublishingPageQuery.getContext の路線クエリと同じ ORDER BY を使うこと。
// 片方だけ順序が違うと、画面のゲート表示（LIMIT 1）と本 API の検証が
// 別々の路線を見て食い違う（公開可能な駅が UI で永久にブロックされる／
// 逆に UI で許可した公開が 422 になる）。
export const LINE_SLUG_ORDER_BY = sql`${lines.slug} NULLS LAST, ${lines.id}`;

async function findLineSlug(tx: Tx, stationId: string): Promise<string | null | undefined> {
  const [row] = await tx
    .select({ slug: lines.slug })
    .from(stationLines)
    .innerJoin(lines, eq(lines.id, stationLines.lineId))
    .where(eq(stationLines.stationId, stationId))
    .orderBy(LINE_SLUG_ORDER_BY)
    .limit(1);
  return row?.slug;
}

export const dbStationPublishingRepository: StationPublishingRepository = {
  async publish(stationId, slug) {
    try {
      return await withTransaction(async (tx) => {
        const [current] = await tx
          .select({ slug: stations.slug, publishedAt: stations.publishedAt })
          .from(stations)
          .where(eq(stations.id, stationId))
          .limit(1);
        if (!current) return false; // 該当駅が無い（route.ts が 404 に写像する）

        const lineSlug = await findLineSlug(tx, stationId);
        if (lineSlug === undefined) return false; // 駅がどの路線にも属していない
        if (!lineSlug) throw new LineSlugMissingError();

        // 既に slug が確定している駅は、その値を維持する（再公開時に同じ URL を保つ。
        // ports.ts / unpublish のコメント参照）。渡された slug で上書きしない。
        // 既に公開中なら publishedAt も動かさない（初回公開日を保持し、冪等にする）。
        const nextSlug = current.slug ?? slug;
        const nextPublishedAt = current.publishedAt ?? new Date();

        const [updated] = await tx
          .update(stations)
          .set({ slug: nextSlug, publishedAt: nextPublishedAt, updatedAt: new Date() })
          .where(eq(stations.id, stationId))
          .returning({ id: stations.id });
        return !!updated;
      });
    } catch (err) {
      if (isPgErrorCode(err, PG_UNIQUE_VIOLATION)) {
        throw new SlugTakenError();
      }
      throw err;
    }
  },

  async unpublish(stationId) {
    // slug は消さない（再公開時に同じ URL を維持する。
    // docs/domain/station-visibility.md / station-master-model.md「slug の導出規則」）
    const [updated] = await db
      .update(stations)
      .set({ publishedAt: null, updatedAt: new Date() })
      .where(eq(stations.id, stationId))
      .returning({ id: stations.id });
    return !!updated;
  },
};
