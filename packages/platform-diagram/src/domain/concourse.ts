import type { ConcourseDTO, FacilityConnectionDTO } from './types';

/**
 * 「設備・乗換情報」に出せる情報を持つコンコースか。
 * 設備が1件も無くても、出口名や乗換先だけで利用者にとって意味のある情報になる。
 */
export function hasDisplayableInfo(concourse: Pick<ConcourseDTO, 'cells' | 'exits' | 'connections'>): boolean {
  return concourse.cells.length > 0 || exitsLabel(concourse) !== null || concourse.connections.length > 0;
}

/**
 * 方面名に「方面」を添える。
 *
 * lineDirections.displayName は「新宿・荻窪・方南町方面」のように
 * すでに「方面」で終わっていることがある。無条件に足すと「方面方面」になる。
 */
export function directionPhrase(directionName: string): string {
  const trimmed = directionName.trim();
  return trimmed.endsWith('方面') ? trimmed : `${trimmed}方面`;
}

/** 出口名。空文字・空白のみは未入力として扱う */
export function exitsLabel(concourse: Pick<ConcourseDTO, 'exits'>): string | null {
  return concourse.exits?.trim() || null;
}

/** 乗換先の表示ラベル。接続1件につき1要素を返す */
export function connectionLabels(concourse: Pick<ConcourseDTO, 'connections'>): string[] {
  return concourse.connections.map((conn) => {
    // 路線が引けない接続でも空文字にならないよう駅名で代替する
    const lineLabel = conn.lineNames.length > 0 ? conn.lineNames.join('・') : conn.stationName;
    const base = conn.directionName
      ? `${lineLabel}（${directionPhrase(conn.directionName)}）`
      : lineLabel;
    // exitLabel は管理画面では「備考（任意）」の自由入力。内容を解釈せずそのまま添える
    return conn.exitLabel ? `${base}［${conn.exitLabel}］` : base;
  });
}

/** 路線カラー未設定時の既定色。対面乗換ティントのフォールバックと揃える */
export const DEFAULT_LINE_COLOR = '#9ca3af';

/** 乗換プレートに並べる路線1件 */
export type TransferLine = { name: string; color: string };

/** 乗換プレート1件ぶんの構造。表示のために情報を落とさない */
export type TransferEntry = {
  /** 接続先駅に乗り入れる全路線。1件も省略しない */
  lines: TransferLine[];
  /** 路線が1件も引けないときに代わりに見出しへ出す駅名 */
  stationName: string;
  directionName: string | null;
  exitLabel: string | null;
};

/**
 * 乗換プレート用の構造化データ。接続1件につき1要素を返す。
 *
 * 路線名を「・」で連結した1本の文字列にせず、路線ごとに分けて返すのは、
 * 描画側が路線カラーのチップを添えて折り返せるようにするため。
 * lineNames には「接続先駅に乗り入れる全路線」が入り、新宿・渋谷級では
 * 6路線以上になるが、**畳まずに全件返す**（図の中で折り返して見せる）。
 */
export function transferEntries(concourse: Pick<ConcourseDTO, 'connections'>): TransferEntry[] {
  return concourse.connections.map((conn) => ({
    // lineNames と lineColors は同じ並びで組み立てられている（external/query）。
    // 万一長さがずれても路線名を落とさないよう、名前を基準に添字で引く
    lines: conn.lineNames.map((name, i) => ({
      name,
      color: conn.lineColors[i] ?? DEFAULT_LINE_COLOR,
    })),
    stationName: conn.stationName,
    directionName: conn.directionName,
    exitLabel: conn.exitLabel,
  }));
}

/** 対面乗換ティント・チップの色。路線が複数あれば先頭を代表色とする */
export function primaryLineColor(
  connection: Pick<FacilityConnectionDTO, 'lineColors'>,
): string {
  return connection.lineColors[0] ?? DEFAULT_LINE_COLOR;
}

/**
 * 対面乗換の案内文。「◯◯線（△△方面）は同じホームの向かい側に到着」
 *
 * 帯を塗るだけでは何が起きるのか伝わらないので、図の中に文章として出す。
 * 文言をJSXに埋めるとテストできないため、ここで組み立てる。
 */
export function facingTransferText(
  connection: Pick<FacilityConnectionDTO, 'stationName' | 'lineNames' | 'directionName'>,
): string {
  // 路線が引けない接続でも空文字にならないよう駅名で代替する（connectionLabels と同じ）
  const lineLabel =
    connection.lineNames.length > 0 ? connection.lineNames.join('・') : connection.stationName;
  const subject = connection.directionName
    ? `${lineLabel}（${directionPhrase(connection.directionName)}）`
    : lineLabel;
  return `${subject}は同じホームの向かい側に到着`;
}
