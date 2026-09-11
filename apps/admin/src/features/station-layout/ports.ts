import type {
  PlatformDTO, TrainStopPatternDTO, FacilityDTO, ConcourseCellDTO, FacilityConnectionDTO, ConcourseDTO,
} from '@furatora/platform-diagram/domain';

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

// PR3で追加した編集専用フィールド。PUT platform-locations がコンコース全体を
// delete→insertする全置換のため、往復に必要な値をパッケージのDTOより広く持たせる。
// packages/platform-diagram の types.ts には足さない（web への供給義務が生じ、
// パッケージが編集用フィールドを抱え込むことになる。ADR-0010「レビュー」節参照）。

/** stationFacilities.notes を追加した設備DTO */
export type LayoutFacilityDTO = FacilityDTO & { notes: string | null };

/** platformLocationCells.id を追加したアクセス点DTO（draftのキー・React keyに使う） */
export type LayoutCellDTO = Omit<ConcourseCellDTO, 'facilities'> & {
  id: string;
  facilities: LayoutFacilityDTO[];
};

/** facilityConnections の connectedStationId/connectedPlatformId/directionId を追加した乗換DTO */
export type LayoutConnectionDTO = FacilityConnectionDTO & {
  connectedStationId: string;
  connectedPlatformId: string | null;
  directionId: string | null;
};

/** platformLocations.notes を追加したコンコースDTO */
export type LayoutConcourseDTO = Omit<ConcourseDTO, 'cells' | 'connections'> & {
  notes: string | null;
  cells: LayoutCellDTO[];
  connections: LayoutConnectionDTO[];
};

export type LayoutPlatformDetailDTO = Omit<PlatformDTO, 'stopPatterns' | 'concourses'> & {
  stopPatterns: LayoutStopPatternDTO[];
  concourses: LayoutConcourseDTO[];
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
