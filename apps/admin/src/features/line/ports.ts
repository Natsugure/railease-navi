// 読み取り: Query Service（ADR-0003）。路線の編集ページと、方面の新規・編集ページが
// 必要とする1画面分の DTO を返す。admin 全体の Query Service 化は #48 だが、
// フォームのクライアント側 fetch 廃止（#49）に伴い先行導入する。
//
// この feature は schema.ts / domain/ を持たない。ports.ts のみ。

export type OperatorOption = { id: string; name: string };

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

export interface LineEditPageQuery {
  // 該当路線が無ければ null（ページは notFound() する）
  getEditContext(lineId: string): Promise<LineEditContext | null>;
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
