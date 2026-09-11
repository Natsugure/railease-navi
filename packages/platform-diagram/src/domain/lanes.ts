// 横方向に重なりうる要素を、重ならない「レーン（段）」に振り分ける。
// コンコースプレートと対面乗換バナーの両方が同じ機構に乗る。

/** レーン割り当ての対象。x方向の占有区間だけを見る */
export type LaneItem = { startPx: number; endPx: number };

/**
 * 貪欲法（first-fit）で各要素をレーンに振り分ける（純関数）。
 *
 * startPx 昇順に見て、直前の要素との間隔が足りる**最も内側の**レーンへ置く。
 * これにより図に近いレーンから順に埋まり、引き出し線が短くなる。
 *
 * **高さは一切扱わない。** レーンの高さは中身の折り返し次第で決まるが、
 * それはブラウザのCSSが解決する領域であり、ここで行数を推定すると
 * 実フォント（日本語はシステムフォールバックで環境依存）とずれて必ず破綻する。
 * ここが決めるのは「誰と誰が同じ段に並べるか」だけ。
 *
 * @param gapPx 同じレーンに並ぶ要素どうしの最小間隔。幅の見積り誤差もここで吸収する
 */
export function assignLanes<T extends LaneItem>(items: T[], gapPx: number): (T & { lane: number })[] {
  const laneRightEdges: number[] = [];

  return [...items]
    .sort((a, b) => a.startPx - b.startPx)
    .map((item) => {
      let lane = laneRightEdges.findIndex((right) => item.startPx - right >= gapPx);
      if (lane === -1) lane = laneRightEdges.length;
      // 幅が負の要素が混じっても右端が巻き戻らないようにする
      laneRightEdges[lane] = Math.max(item.endPx, item.startPx);
      return { ...item, lane };
    });
}

/** 割り当て済みの要素から、必要なレーン数を求める */
export function laneCount(items: { lane: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.lane + 1), 0);
}
