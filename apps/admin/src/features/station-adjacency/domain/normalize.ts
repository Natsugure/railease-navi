// 隣接（stationAdjacencies）の端点 UUID の昇順正規化。
//
// unique_station_adjacency(line_id, station_a_id, station_b_id) は3つ組の順序に依存し、
// 逆向きペア（(a,b) と (b,a)）を別行として通す。DB 制約では逆向き重複を防げないため、
// 書き込み側がこの正規化を必ず通すことで、辺が逆向きに与えられても重複行にならない
// （docs/domain/station-master-model.md「隣接」）。
//
// UUID の文字列は辞書順で全順序が定まる。等値（自己隣接）はそのまま返す
// （排除は schema の .refine() の責務）。
export function normalizeAdjacencyEndpoints(
  x: string,
  y: string,
): { stationAId: string; stationBId: string } {
  return x <= y
    ? { stationAId: x, stationBId: y }
    : { stationAId: y, stationBId: x };
}
