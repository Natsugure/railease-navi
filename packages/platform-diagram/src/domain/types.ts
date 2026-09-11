// 駅詳細画面（ホーム・列車・設備）用のDTO定義。Drizzle非依存（ADR-0003）。
// decimal → number の変換は external/query/ の中で行い、ここより上には string を渡さない
// （docs/domain/platform-coordinate-system.md「単位と精度」）。

export type FacilityDTO = {
  id: string;
  typeCode: string;
  typeName: string;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
};

// アクセス点。xPositionMeters が null の場合はコンコース全体を指す（SVGには描かない）
export type ConcourseCellDTO = {
  xPositionMeters: number | null;
  facilities: FacilityDTO[];
};

// xRangeStart/xRangeEnd が両方非nullのときのみ、自ホーム座標系での対面乗換帯を表す
export type FacilityConnectionDTO = {
  stationName: string;
  lineNames: string[];
  lineColors: (string | null)[];
  directionName: string | null;
  exitLabel: string | null;
  xRangeStart: number | null;
  xRangeEnd: number | null;
};

export type ConcourseDTO = {
  id: string;
  exits: string | null;
  cells: ConcourseCellDTO[];
  connections: FacilityConnectionDTO[];
};

export type StopPatternCarDTO = {
  carNumber: number;
  startMeters: number;
  endMeters: number;
  doorCount: number; // trainCarStructures 由来。未登録の場合は4を補う
  freeSpaceDoors: { nearDoor: number; isStandard: boolean }[];
  prioritySeatDoors: { nearDoor: number; isStandard: boolean }[];
};

export type TrainStopPatternDTO = {
  trainId: string;
  trainLabel: string;
  carCount: number;
  cars: StopPatternCarDTO[]; // carNumber 昇順
};

export type PlatformDTO = {
  id: string;
  platformNumber: string;
  lineId: string;
  lineName: string;
  lineColor: string | null;
  inboundDirectionId: string | null;
  inboundDirectionName: string | null;
  outboundDirectionId: string | null;
  outboundDirectionName: string | null;
  platformSide: 'top' | 'bottom' | null;
  notes: string | null;
  physicalLength: number; // 0 = 未入力（描画スキップ。docs/domain/platform-coordinate-system.md）
  stopPatterns: TrainStopPatternDTO[];
  concourses: ConcourseDTO[];
};

export type DirectionTabDTO = {
  directionId: string | null;
  directionName: string;
  platforms: PlatformDTO[];
};
