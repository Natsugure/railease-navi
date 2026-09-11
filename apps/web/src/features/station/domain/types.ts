import type { StrollerDifficulty, WheelchairDifficulty } from '@furatora/database/enums';
import type { DirectionTabDTO, PlatformDTO } from '@furatora/platform-diagram/domain';

// 駅詳細画面用のDTO定義。Drizzle非依存（ADR-0003）。
// decimal → number の変換は external/query/ の中で行う。
// station は platform に依存してよい（ADR-0001 feature間依存ルール）。

export type TransferConnectionDTO = {
  lineName: string;
  lineColor: string | null;
  strollerDifficulty: StrollerDifficulty | null;
  wheelchairDifficulty: WheelchairDifficulty | null;
  notesAboutStroller: string | null;
  notesAboutWheelchair: string | null;
};

export type StationDetailDTO = {
  station: {
    id: string;
    name: string;
    nameEn: string | null;
    code: string | null;
    notes: string | null;
  };
  headerLineColor: string | null; // StationBadge 用
  platforms: PlatformDTO[];
  transferConnections: TransferConnectionDTO[];
};

// usecase の戻り値。方面タブ構築済み
export type StationDetailView = StationDetailDTO & { tabs: DirectionTabDTO[] };
