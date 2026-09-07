import type { PlatformLocationInput } from './schema';

export type PlatformLocationRecord = {
  id: string;
  platformId: string;
  exits: string | null;
  notes: string | null;
};

export interface PlatformLocationRepository {
  create(input: PlatformLocationInput): Promise<PlatformLocationRecord>;
  update(id: string, input: PlatformLocationInput): Promise<PlatformLocationRecord | null>;
  delete(id: string): Promise<boolean>;
  duplicate(id: string): Promise<PlatformLocationRecord | null>;
}

// 読み取り: Query Service（ADR-0003）。設備場所の新規・編集ページが必要とする
// 1画面分の DTO を返す。admin 全体の Query Service 化は #48 だが、
// フォームのクライアント側 fetch 廃止（#49）に伴い先行導入する。
//
// 接続候補駅にホーム・方面をネストして返すのが肝。従来は接続候補駅ごとに
// 2本の fetch を投げていた（N+1）。ここでサーバー側の inArray クエリ群にまとめる。

export type FacilityPlatformOption = {
  id: string;
  platformNumber: string;
  // decimal をそのまま文字列で返す（フォーム側で Number 化して長さ表示に使う）
  physicalLength: string;
};

export type FacilityTypeOption = { code: string; name: string };

export type ConnectedStationOption = {
  id: string;
  name: string;
  code: string | null;
  // 1駅が複数路線を持ち得るため配列。stationLines に unique(stationId) を付けない
  // 理由は packages/database/src/schema.ts の stationLines 直前のコメントを参照。
  // 単数で持つと駅が路線ごとに重複行になり、同じ駅を二重にチェックできてしまう
  // （facility_connections の unique(platformLocationId, connectedStationId) に抵触する）
  lines: { id: string; name: string }[];
  platforms: { id: string; platformNumber: string }[];
  directions: { id: string; displayName: string }[];
};

export type FacilityLocationDTO = {
  id: string;
  platformId: string;
  exits: string;
  notes: string;
  cells: {
    xPositionMeters: number | null;
    facilities: {
      typeCode: string;
      isWheelchairAccessible: boolean;
      isStrollerAccessible: boolean;
      notes: string;
    }[];
  }[];
  connections: {
    stationId: string;
    connectedPlatformId: string | null;
    directionId: string | null;
    exitLabel: string;
    xRangeStart: number | null;
    xRangeEnd: number | null;
  }[];
};

export type FacilityEditContext = {
  stationName: string;
  platforms: FacilityPlatformOption[];
  facilityTypes: FacilityTypeOption[];
  connectedStations: ConnectedStationOption[];
  location?: FacilityLocationDTO;
};

export interface FacilityEditPageQuery {
  // 駅が無ければ null（ページは notFound() する）
  getCreateContext(stationId: string): Promise<FacilityEditContext | null>;
  // 駅・場所が無い、または場所が別駅のホームに属するなら null
  getEditContext(stationId: string, locationId: string): Promise<FacilityEditContext | null>;
}
