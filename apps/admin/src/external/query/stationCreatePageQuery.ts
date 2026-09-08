import { db } from '@furatora/database/client';
import { operators, lines, stationGroups } from '@furatora/database/schema';
import { asc, eq } from 'drizzle-orm';
import type {
  StationCreatePageQuery, StationCreateContext,
} from '@/features/station/ports';

// admin 全体の Query Service 化は #48。ここは駅の新規作成（#88）で追加。
//
// 事業者（162）と路線（602）は全件返す。フォーム側で事業者選択に応じて路線を絞るため、
// 段階選択で実際に描画されるのは1事業者ぶんに縮む。乗換単位グループ（8,782）は
// 都道府県が選ばれたときだけ、その都道府県ぶんを返す（全件は返さない）。
export const dbStationCreatePageQuery: StationCreatePageQuery = {
  async getCreateContext(prefCode) {
    const [operatorOptions, lineOptions] = await Promise.all([
      db
        .select({ id: operators.id, name: operators.name })
        .from(operators)
        .orderBy(asc(operators.name)),
      db
        .select({ id: lines.id, name: lines.name, operatorId: lines.operatorId })
        .from(lines)
        .orderBy(asc(lines.displayOrder)),
    ]);

    const groupOptions =
      prefCode === undefined
        ? []
        : await db
            .select({
              id: stationGroups.id,
              name: stationGroups.name,
              prefCode: stationGroups.prefCode,
            })
            .from(stationGroups)
            .where(eq(stationGroups.prefCode, prefCode))
            .orderBy(asc(stationGroups.name));

    const context: StationCreateContext = {
      operators: operatorOptions,
      lines: lineOptions,
      stationGroups: groupOptions,
    };
    return context;
  },
};
