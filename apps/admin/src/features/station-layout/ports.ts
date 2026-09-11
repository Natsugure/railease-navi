import type { PlatformDTO, TrainStopPatternDTO } from '@furatora/platform-diagram/domain';

// 読み取り: Query Service（ADR-0003）。駅レイアウト統合ページ（Issue #95 PR2）が
// 必要とする1画面分のDTOを返す。旧 facilities/page.tsx が db を直接 import して
// 8箇所のクエリ（うち路線解決はN+1）を直書きしていたのを、この1本に集約する。
//
// design.md の StationLayoutContext は lines / facilityTypes / connectedStations /
// trains も含む形で構想されているが、それらはPR4のインスペクタ（テキストフォーム統合）
// が必要とする選択肢データであり、読み取り専用のPR2では使わない。YAGNIに従い
// PR4着手時に追加する。

// タブ用の軽量情報。全ホーム分を返す（詳細は持たない）
export type LayoutPlatformDTO = {
  id: string;
  platformNumber: string;
  lineName: string;
  lineColor: string | null;
  directionLabel: string; // inbound / outbound を ' / ' で連結済み。両方無ければ空文字
};

export type LayoutStopPatternDTO = TrainStopPatternDTO & {
  // trainStopPatterns.id。URL の ?patternId= やPR3の保存先APIが必要とするが、
  // パッケージの TrainStopPatternDTO は表示に不要なため trainId しか持たない
  patternId: string;
};

// PlatformDTO（packages/platform-diagram の表示用DTO）を土台に、選択中パターンの
// 情報を足したもの。編集専用フィールド（platformLocationCells.id 等）はPR3で追加する
export type LayoutPlatformDetailDTO = Omit<PlatformDTO, 'stopPatterns'> & {
  stopPatterns: LayoutStopPatternDTO[];
  // 図に重ねるパターン。ホームに停車位置パターンが1件も無ければ null
  selectedPatternId: string | null;
};

export type StationLayoutContext = {
  stationName: string;
  platforms: LayoutPlatformDTO[]; // タブ用。ホームが1件も無ければ空配列
  // 選択中ホームの全データ。駅にホームが1件も無ければ null（一覧のみ表示）
  platform: LayoutPlatformDetailDTO | null;
};

export interface StationLayoutPageQuery {
  // 駅が無ければ null（ページは notFound() する）
  getContext(
    stationId: string,
    selection: { platformId?: string; patternId?: string },
  ): Promise<StationLayoutContext | null>;
}
