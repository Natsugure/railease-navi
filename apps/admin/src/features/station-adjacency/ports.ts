// 路線内の隣接（stationAdjacencies）の作成・削除（#88）。
//
// 書き込み: Repository（ADR-0003）。端点 UUID の昇順正規化（domain/normalize.ts）を
// 必ず通してから INSERT する。unique_station_adjacency は順序依存で逆向きペアを
// 別行として通すため、正規化は書き込み側が守る規約（docs/domain/station-master-model.md「隣接」）。
// 単一テーブル単一行のため withTransaction は使わない（ADR-0005）。
//
// 読み取り: Query Service（ADR-0003）。隣接管理ページが必要とする路線名・駅一覧・既存隣接。

/** 隣接の端点が対象路線に属していない（route.ts が 422 に写像する） */
export class AdjacencyEndpointNotOnLineError extends Error {
  constructor() {
    super('隣接の端点がこの路線に属していません');
    this.name = 'AdjacencyEndpointNotOnLineError';
  }
}

export interface StationAdjacencyRepository {
  // 端点を昇順正規化し、両端点が lineId に属することを検証してから冪等に挿入する。
  // 端点が路線に属さなければ AdjacencyEndpointNotOnLineError。
  create(lineId: string, stationAId: string, stationBId: string): Promise<void>;
  // 当該路線の隣接行を削除する。消えれば true。
  delete(lineId: string, adjacencyId: string): Promise<boolean>;
}

// --- 読み取り ---

export type AdjacencyLineStation = {
  id: string;
  name: string;
  stationOrder: number | null;
};

export type AdjacencyRow = {
  id: string;
  stationAId: string;
  stationAName: string;
  stationBId: string;
  stationBName: string;
};

export type StationAdjacencyPageContext = {
  lineName: string;
  stations: AdjacencyLineStation[];
  adjacencies: AdjacencyRow[];
};

export interface StationAdjacencyPageQuery {
  // 路線が無ければ null
  getPageContext(lineId: string): Promise<StationAdjacencyPageContext | null>;
}
