import { db } from '@furatora/database/client';
import { stations, stationLines, platforms, lines, lineDirections } from '@furatora/database/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type {
  PlatformEditPageQuery, PlatformEditContext, LineWithDirections,
} from '@/features/platform/ports';

// admin 全体の Query Service 化は #48。ここは #49 で先行導入したもの。
//
// 方面を路線にネストして返す。PlatformForm はこれにより路線切替時の
// fetch（/api/lines/{id}/directions）とレースが不要になる（#49 / #32）。

// 当該駅の stationLines に載っている路線だけを返す。
// ホームは駅に停車する路線に属するものなので、それ以外の路線を選択肢に出す意味がない。
// かつ lines は実測 602 件あり（#49 設計時の想定 62 件は古い）、全件を返すと
// ホームの新規・編集ページを開くたびに RSC ペイロードへ全路線が載る。
async function getLinesWithDirections(stationId: string): Promise<LineWithDirections[]> {
  const stationLineIds = db
    .select({ lineId: stationLines.lineId })
    .from(stationLines)
    .where(eq(stationLines.stationId, stationId));

  const [lineRows, directionRows] = await Promise.all([
    db
      .select({ id: lines.id, name: lines.name })
      .from(stationLines)
      .innerJoin(lines, eq(lines.id, stationLines.lineId))
      .where(eq(stationLines.stationId, stationId))
      .orderBy(asc(lines.displayOrder)),
    db
      .select({
        id: lineDirections.id,
        lineId: lineDirections.lineId,
        directionType: lineDirections.directionType,
        displayName: lineDirections.displayName,
      })
      .from(lineDirections)
      .where(inArray(lineDirections.lineId, stationLineIds))
      .orderBy(asc(lineDirections.directionType)),
  ]);

  return lineRows.map((line) => {
    const forLine = directionRows.filter((d) => d.lineId === line.id);
    return {
      id: line.id,
      name: line.name,
      inboundDirections: forLine
        .filter((d) => d.directionType === 'inbound')
        .map((d) => ({ id: d.id, displayName: d.displayName })),
      outboundDirections: forLine
        .filter((d) => d.directionType === 'outbound')
        .map((d) => ({ id: d.id, displayName: d.displayName })),
    };
  });
}

export const dbPlatformEditPageQuery: PlatformEditPageQuery = {
  async getCreateContext(stationId) {
    const [[station], linesWithDirections] = await Promise.all([
      db.select({ name: stations.name }).from(stations).where(eq(stations.id, stationId)),
      getLinesWithDirections(stationId),
    ]);
    if (!station) return null;

    return { stationName: station.name, lines: linesWithDirections };
  },

  async getEditContext(stationId, platformId) {
    // station / platform / lines は互いに独立なので並列に引き、null 判定は解決後に行う
    const [[station], [platform], linesWithDirections] = await Promise.all([
      db.select({ name: stations.name }).from(stations).where(eq(stations.id, stationId)),
      db
        .select()
        .from(platforms)
        .where(and(eq(platforms.id, platformId), eq(platforms.stationId, stationId))),
      getLinesWithDirections(stationId),
    ]);
    if (!station || !platform) return null;

    const context: PlatformEditContext = {
      stationName: station.name,
      lines: linesWithDirections,
      platform: {
        id: platform.id,
        platformNumber: platform.platformNumber,
        lineId: platform.lineId,
        inboundDirectionId: platform.inboundDirectionId,
        outboundDirectionId: platform.outboundDirectionId,
        physicalLength: Number(platform.physicalLength),
        platformSide: platform.platformSide ?? null,
        notes: platform.notes ?? '',
      },
    };
    return context;
  },
};
