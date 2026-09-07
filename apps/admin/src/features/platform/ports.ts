import type { PlatformInput } from './schema';

export type PlatformRecord = {
  id: string;
  stationId: string;
  platformNumber: string;
  lineId: string;
  inboundDirectionId: string | null;
  outboundDirectionId: string | null;
  physicalLength: string;
  platformSide: string | null;
  notes: string | null;
};

export interface PlatformRepository {
  create(stationId: string, input: PlatformInput): Promise<PlatformRecord>;
  update(id: string, stationId: string, input: PlatformInput): Promise<PlatformRecord | null>;
  delete(id: string, stationId: string): Promise<boolean>;
}

// 読み取り: Query Service（ADR-0003）。ホームの新規・編集ページが必要とする
// 1画面分の DTO を返す。admin 全体の Query Service 化は #48 だが、
// フォームのクライアント側 fetch 廃止（#49）に伴い先行導入する。

// 方面は路線にネストして渡す。これにより PlatformForm 側の
// inbound/outboundDirections が「選択中路線からの純粋な派生値」になり、
// 路線切替時の fetch とレースが消える（#49 / #32）。
export type LineWithDirections = {
  id: string;
  name: string;
  inboundDirections: { id: string; displayName: string }[];
  outboundDirections: { id: string; displayName: string }[];
};

export type PlatformEditContext = {
  stationName: string;
  lines: LineWithDirections[];
  platform?: {
    id: string;
    platformNumber: string;
    lineId: string;
    inboundDirectionId: string | null;
    outboundDirectionId: string | null;
    physicalLength: number;
    platformSide: string | null;
    notes: string;
  };
};

export interface PlatformEditPageQuery {
  // 駅が無ければ null（ページは notFound() する）
  getCreateContext(stationId: string): Promise<PlatformEditContext | null>;
  // 駅・ホームが無い、またはホームが別駅のものなら null
  getEditContext(stationId: string, platformId: string): Promise<PlatformEditContext | null>;
}
