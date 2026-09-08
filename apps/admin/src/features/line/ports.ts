// 読み取り: Query Service（ADR-0003）。路線の編集・新規ページと、方面の新規・編集ページが
// 必要とする1画面分の DTO を返す。admin 全体の Query Service 化は #48 だが、
// フォームのクライアント側 fetch 廃止（#49）に伴い先行導入した。
//
// 書き込み: Repository（ADR-0003）。路線の新規作成（#88）で追加。
// この feature は schema.ts を持つ（`lineCreateSchema`）。domain/ は持たない。

import type { LineCreateInput } from './schema';

export type OperatorOption = { id: string; name: string };

// --- 書き込み（#88）---

export type LineRecord = {
  id: string;
  name: string;
  operatorId: string;
};

export interface LineRepository {
  // lines へ1行 INSERT する。単一テーブル単一行のため withTransaction は使わない
  // （ADR-0005「単一テーブルの単純な書き込み」）。slug / ekidataLineCd は設定しない。
  create(input: LineCreateInput): Promise<LineRecord>;
}

// --- 読み取り ---

export type LineEditContext = {
  line: {
    name: string;
    nameKana: string | null;
    nameEn: string | null;
    odptRailwayId: string | null;
    slug: string | null;
    lineCode: string | null;
    color: string | null;
    displayOrder: number;
    operatorId: string;
  };
  operators: OperatorOption[];
};

// 新規作成ページの選択肢（事業者のみ）。
export type LineCreateContext = {
  operators: OperatorOption[];
};

export interface LineEditPageQuery {
  // 該当路線が無ければ null（ページは notFound() する）
  getEditContext(lineId: string): Promise<LineEditContext | null>;
  // 新規作成ページ用。路線が存在しないので null は返さない
  getCreateContext(): Promise<LineCreateContext>;
}

// --- 方面（line_directions）---

export type DirectionStationOption = {
  id: string;
  name: string;
  nameEn: string | null;
  code: string | null;
};

export type LineDirectionEditContext = {
  lineName: string;
  // その路線に属する駅（stationLines.stationOrder 順）。代表駅・終点駅の選択肢。
  stations: DirectionStationOption[];
  direction?: {
    id: string;
    directionType: string;
    representativeStationId: string;
    displayName: string;
    displayNameEn: string;
    terminalStationIds: string[] | null;
    notes: string;
  };
};

export interface LineDirectionEditPageQuery {
  // 路線が無ければ null
  getCreateContext(lineId: string): Promise<LineDirectionEditContext | null>;
  // 路線・方面が無い、または方面が別路線のものなら null
  getEditContext(lineId: string, directionId: string): Promise<LineDirectionEditContext | null>;
}
