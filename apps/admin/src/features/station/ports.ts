import type { StrollerDifficulty, WheelchairDifficulty } from '@furatora/database/enums';

// 読み取り: Query Service（ADR-0003）。駅の編集ページが必要とする1画面分の DTO を返す。
// admin 全体の Query Service 化は #48 だが、フォームのクライアント側 fetch 廃止（#49）に
// 伴い先行導入する。この feature は schema.ts / domain/ を持たない。ports.ts のみ。
//
// @furatora/database/enums は純粋な union 型のみのため全層で import 可（ADR-0001）。

export type OperatorOption = { id: string; name: string };

// 乗り換え接続の1行。難易度・備考は編集対象。駅名/路線名は表示用に解決済み。
export type ConnectionRow = {
  id: string;
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
