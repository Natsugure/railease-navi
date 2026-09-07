import { db } from '@furatora/database/client';
import { operators, lines, lineDirections, stationLines, stations } from '@furatora/database/schema';
import { and, asc, eq } from 'drizzle-orm';
import type {
  LineEditPageQuery, LineDirectionEditPageQuery,
  LineDirectionEditContext, OperatorOption, DirectionStationOption,
} from '@/features/line/ports';

// admin 全体の Query Service 化は #48。ここは #49 で先行導入したもの。

async function getOperatorOptions(): Promise<OperatorOption[]> {
  return db
    .select({ id: operators.id, name: operators.name })
    .from(operators)
    .orderBy(asc(operators.name));
}

export const dbLineEditPageQuery: LineEditPageQuery = {
  async getEditContext(lineId) {
    const [line] = await db.select().from(lines).where(eq(lines.id, lineId)).limit(1);
    if (!line) return null;

    const operatorOptions = await getOperatorOptions();

    return {
      line: {
        name: line.name,
        nameKana: line.nameKana,
        nameEn: line.nameEn,
        odptRailwayId: line.odptRailwayId,
        slug: line.slug,
        lineCode: line.lineCode,
        color: line.color,
        displayOrder: line.displayOrder ?? 0,
        operatorId: line.operatorId,
      },
      operators: operatorOptions,
    };
  },
};

async function getLineStations(lineId: string): Promise<DirectionStationOption[]> {
  return db
    .select({
      id: stations.id,
      name: stations.name,
      nameEn: stations.nameEn,
      code: stations.code,
    })
    .from(stationLines)
    .innerJoin(stations, eq(stationLines.stationId, stations.id))
    .where(eq(stationLines.lineId, lineId))
    .orderBy(asc(stationLines.stationOrder));
}

export const dbLineDirectionEditPageQuery: LineDirectionEditPageQuery = {
  async getCreateContext(lineId) {
    const [line] = await db.select({ name: lines.name }).from(lines).where(eq(lines.id, lineId)).limit(1);
    if (!line) return null;

    const lineStations = await getLineStations(lineId);
    return { lineName: line.name, stations: lineStations };
  },

  async getEditContext(lineId, directionId) {
    const [line] = await db.select({ name: lines.name }).from(lines).where(eq(lines.id, lineId)).limit(1);
    if (!line) return null;

    const [direction] = await db
      .select()
      .from(lineDirections)
      .where(and(eq(lineDirections.id, directionId), eq(lineDirections.lineId, lineId)));
    if (!direction) return null;

    const lineStations = await getLineStations(lineId);

    const context: LineDirectionEditContext = {
      lineName: line.name,
      stations: lineStations,
      direction: {
        id: direction.id,
        directionType: direction.directionType,
        representativeStationId: direction.representativeStationId,
        displayName: direction.displayName,
        displayNameEn: direction.displayNameEn ?? '',
        terminalStationIds: direction.terminalStationIds,
        notes: direction.notes ?? '',
      },
    };
    return context;
  },
};
