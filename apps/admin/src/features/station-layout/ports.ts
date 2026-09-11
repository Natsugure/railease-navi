import type { PlatformDTO, TrainStopPatternDTO } from '@furatora/platform-diagram/domain';

// 読み取り: Query Service（ADR-0003）。
// design.md の lines / facilityTypes / connectedStations / trains はPR4のインスペクタ専用のため、PR4着手時に追加する

/** ホームタブ用の軽量情報 */
export type LayoutPlatformDTO = {
  id: string;
  platformNumber: string;
};

export type LayoutStopPatternDTO = TrainStopPatternDTO & {
  /** trainStopPatterns.id。URL の ?patternId= に使う（パッケージのDTOは表示用のため持たない） */
  patternId: string;
};

// 編集専用フィールド（platformLocationCells.id 等）はPR3で追加する
export type LayoutPlatformDetailDTO = Omit<PlatformDTO, 'stopPatterns'> & {
  stopPatterns: LayoutStopPatternDTO[];
  /** 図に重ねるパターン。停車位置パターンが1件も無ければ null */
  selectedPatternId: string | null;
};

export type StationLayoutContext = {
  stationName: string;
  platforms: LayoutPlatformDTO[];
  /** 選択中ホームの全データ。駅にホームが1件も無ければ null */
  platform: LayoutPlatformDetailDTO | null;
};

export interface StationLayoutPageQuery {
  /** 駅が無ければ null。駅に属さない platformId / patternId は先頭にフォールバックする */
  getContext(
    stationId: string,
    selection: { platformId?: string; patternId?: string },
  ): Promise<StationLayoutContext | null>;
}
