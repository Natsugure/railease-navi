import type { StrollerDifficulty, WheelchairDifficulty } from '@furatora/database/enums';
import type { StationCreateInput } from './schema';

// 読み取り: Query Service（ADR-0003）。駅の編集・新規ページが必要とする1画面分の DTO を返す。
// admin 全体の Query Service 化は #48 だが、フォームのクライアント側 fetch 廃止（#49）に
// 伴い先行導入した。
//
// 書き込み: Repository（ADR-0003）。駅の新規作成（#88）で追加。stations + stationLines の
// 2テーブルに書くため withTransaction を使う（ADR-0005）。
// この feature は schema.ts を持つ（`stationCreateSchema`）。domain/ は持たない。
//
// @furatora/database/enums は純粋な union 型のみのため全層で import 可（ADR-0001）。

export type OperatorOption = { id: string; name: string };

// --- 書き込み（#88）---

export type StationRecord = { id: string; name: string };

/** 参照先の事業者・路線・駅グループが存在しない（route.ts が 422 に写像する） */
export class StationReferenceNotFoundError extends Error {
  constructor() {
    super('指定された事業者・路線・駅グループのいずれかが存在しません');
    this.name = 'StationReferenceNotFoundError';
  }
}

export interface StationRepository {
  // stations へ1行、stationLines へ1行を1トランザクションで INSERT する。
  // slug / publishedAt / ekidataStationCd は設定しない（NULL）。
  create(input: StationCreateInput): Promise<StationRecord>;
}

// --- 読み取り ---

// 乗り換え接続の1行。難易度・備考は編集対象。駅名/路線名は表示用に解決済み。
// connectedStationId は接続の削除（#88）で使う。有向2行の削除は
// (stationId, connectedStationId) を渡す DELETE エンドポイントが担う。
export type ConnectionRow = {
  id: string;
  connectedStationId: string;
  connectedStationName: string | null;
  connectedLineName: string | null;
  strollerDifficulty: StrollerDifficulty | null;
  wheelchairDifficulty: WheelchairDifficulty | null;
  notesAboutStroller: string | null;
  notesAboutWheelchair: string | null;
};

export type StationEditContext = {
  station: {
    name: string;
    nameKana: string | null;
    nameEn: string | null;
    odptStationId: string | null;
    slug: string | null;
    code: string | null;
    lat: string | null;
    lon: string | null;
    operatorId: string;
    notes: string | null;
  };
  operators: OperatorOption[];
  connections: ConnectionRow[];
};

export interface StationEditPageQuery {
  // 該当駅が無ければ null（ページは notFound() する）
  getEditContext(stationId: string): Promise<StationEditContext | null>;
}

// --- 新規作成ページの選択肢（#88）---

export type LineOption = { id: string; name: string; operatorId: string };

// 既存の乗換単位グループ。新規グループの作成は本 Issue の対象外
// （ekidataStationGroupCd が NOT NULL + UNIQUE のため。別 Issue）。
export type StationGroupOption = { id: string; name: string; prefCode: number | null };

export type StationCreateContext = {
  operators: OperatorOption[];
  // 全路線。フォーム側で選択中の事業者に応じて絞る
  lines: LineOption[];
  // prefCode を指定したときだけ、その都道府県の乗換単位グループを返す。
  // 未指定なら空配列（8,782件を一度に返さない）
  stationGroups: StationGroupOption[];
};

export interface StationCreatePageQuery {
  getCreateContext(prefCode?: number): Promise<StationCreateContext>;
}
