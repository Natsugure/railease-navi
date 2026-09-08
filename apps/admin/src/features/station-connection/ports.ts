// 乗換接続（stationConnections）の作成・削除（#88）。
//
// 書き込み: Repository（ADR-0003）。乗換接続は有向2行で持つ設計で、読み取り側が
// `eq(stationConnections.stationId, stationId)` と片方向しか見ない
// （docs/domain/station-master-model.md「乗換接続」）。UI からは対向行もあわせて作る。
// 2行の原子性が不変条件のため withTransaction を使う（ADR-0005）。
//
// 読み取り: Query Service（ADR-0003）。接続の追加ページが必要とする候補駅を、
// 事業者 → 路線で段階的に絞って返す（全10,625駅を一度に読まない）。

import type { StationConnectionCreateInput } from './schema';

export interface StationConnectionRepository {
  // (stationId → connectedStationId) と (connectedStationId → stationId) の2行を
  // 1トランザクションで冪等に挿入する。source は 'manual'。
  // unique_station_connection(stationId, connectedStationId) を衝突対象にした
  // onConflictDoNothing で、同じ組を再実行しても行が増えない。
  createPair(stationId: string, input: StationConnectionCreateInput): Promise<void>;
  // 有向2行の両方を削除する。1行でも消えれば true。
  deletePair(stationId: string, connectedStationId: string): Promise<boolean>;
}

// --- 読み取り（追加ページの候補）---

export type ConnectionCandidateStation = {
  id: string;
  name: string;
  code: string | null;
  lineName: string;
};

export type StationConnectionCreateContext = {
  stationName: string;
  operators: { id: string; name: string }[];
  // scope.operatorId 指定時のみ、その事業者の路線
  lines: { id: string; name: string }[];
  // scope.lineId 指定時のみ、その路線の駅（自駅は除外、stationOrder 順）
  candidates: ConnectionCandidateStation[];
};

export interface StationConnectionCreatePageQuery {
  // stationId の駅が無ければ null
  getCreateContext(
    stationId: string,
    scope: { operatorId?: string; lineId?: string },
  ): Promise<StationConnectionCreateContext | null>;
}
