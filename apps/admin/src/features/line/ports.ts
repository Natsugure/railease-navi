// 読み取り: Query Service（ADR-0003）。路線の編集・新規ページと、方面の新規・編集ページが
// 必要とする1画面分の DTO を返す。admin 全体の Query Service 化は #48 だが、
// フォームのクライアント側 fetch 廃止（#49）に伴い先行導入した。
//
// 書き込み: Repository（ADR-0003）。路線の新規作成（#88）で追加。
// この feature は schema.ts を持つ（`lineCreateSchema`）。domain/ は持たない。

import type { ListParams, ListResult } from '@/shared/list/params';
import type { OperatorCard } from '@/shared/list/operatorCard';
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

// --- 一覧ページ（#94）---
//
// 駅一覧（features/station/ports.ts の StationList*）と同じ契約に従う
// （ADR-0009）。事業者スコープ化・検索・並び替え・ページングはすべて
// サーバー側（SQL の WHERE / ORDER BY / LIMIT OFFSET）で行い、URL クエリを
// 唯一の状態源とする。並び替えキーは画面固有の文字列 union にし、SQL の
// 列参照や asc()/desc() をこの port に持ち込まない。
//
// 駅一覧と異なり、路線一覧に「路線スコープ」は無い（一覧そのものが路線の
// 集合のため）。スコープは事業者のみ。

export type LineListSort = 'displayOrder' | 'name' | 'lineCode' | 'operator';
export const LINE_LIST_SORT_KEYS: readonly LineListSort[] = ['displayOrder', 'name', 'lineCode', 'operator'];

export type LineListScope = { operatorId?: string };

export type LineListRow = {
  id: string;
  name: string;
  lineCode: string | null;
  color: string | null;
  operatorName: string;
  // 当該路線に属する駅の数（stationLines の件数）
  stationCount: number;
};

export type LineListContext = {
  // 常に返す（事業者セレクトの選択肢。162件）
  operators: OperatorOption[];
  // スコープも検索語も無いときだけ返す（空状態のカード一覧）
  operatorCards: OperatorCard[];
  // 選択中スコープの表示名（見出し用。無ければ null）
  scope: { operatorName: string | null };
  // スコープも検索語も無いときは null（一覧・件数のクエリを発行しない。受け入れ基準）
  result: ListResult<LineListRow> | null;
};

export interface LineListPageQuery {
  getListContext(scope: LineListScope, params: ListParams<LineListSort>): Promise<LineListContext>;
}
