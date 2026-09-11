import type { ConcourseDTO, TrainStopPatternDTO } from './types';

// SVG viewBox の左右に余白として加えるマージン（メートル）。
export const MARGIN_METERS = 5;

export type Bounds = { minX: number; maxX: number };

/**
 * メートル → 画面ピクセルの換算率。
 *
 * 5px/m は「一度に見える両数」と「文字の判読性」の折衷点。320mホームで幅1600pxとなり、
 * 号車番号(2.2m)が11px相当になる。これ以上大きくするとモバイルで2両弱しか収まらない。
 * 画面幅に応じて縮小はしない（縮めると viewBox 単位で指定した文字が判読できなくなる）。
 *
 * 図はSVGとHTMLオーバーレイの2層でできており、この値はキャンバスの最小幅
 * （= viewBox幅 × PX_PER_METER）を決めるためだけに使う。層をまたぐx座標の対応は
 * ピクセルではなく xFraction() の割合で取る。docs/domain/platform-coordinate-system.md 参照。
 */
export const PX_PER_METER = 5;

/**
 * ホーム座標（メートル）を描画範囲内の割合（0..1）に写す。
 *
 * SVG（viewBox のメートル座標）とHTMLオーバーレイ（CSSのパーセント）は単位系が異なるが、
 * 両者が必ずこの関数を経由することで x が一致する。ピクセルで持たないのは、
 * キャンバスが min-width 指定でコンテナに合わせて伸びるため（伸びても割合は不変）。
 *
 * 幅が0の縮退ケースでは 0 を返す。
 */
export function xFraction(x: number, bounds: Bounds): number {
  const width = bounds.maxX - bounds.minX;
  if (width <= 0) return 0;
  return (x - bounds.minX) / width;
}

/**
 * ホーム物理長・全停車位置パターン・全設備・全対面乗換帯の座標から
 * SVG viewBox の描画範囲を算出する（純関数・DB非依存）。
 *
 * [0, physicalLength] は常に描画範囲に含める（ホームの実体そのものであるため。
 * docs/domain/platform-coordinate-system.md「座標の範囲」）。
 */
export function computeBounds(
  physicalLength: number,
  patterns: Pick<TrainStopPatternDTO, 'cars'>[],
  concourses: Pick<ConcourseDTO, 'cells' | 'connections'>[],
): Bounds {
  const candidates: number[] = [0, physicalLength];

  for (const pattern of patterns) {
    for (const car of pattern.cars) {
      candidates.push(car.startMeters, car.endMeters);
    }
  }

  for (const concourse of concourses) {
    for (const cell of concourse.cells) {
      if (cell.xPositionMeters !== null) {
        candidates.push(cell.xPositionMeters);
      }
    }
    for (const connection of concourse.connections) {
      if (connection.xRangeStart !== null && connection.xRangeEnd !== null) {
        candidates.push(connection.xRangeStart, connection.xRangeEnd);
      }
    }
  }

  const minX = Math.min(...candidates) - MARGIN_METERS;
  const maxX = Math.max(...candidates) + MARGIN_METERS;

  return { minX, maxX };
}

// ---- 縦方向レイアウト ----
// SVG座標系の単位はメートル（横方向と共通）。縦方向は実寸ではなく、
// 「束ね線 / 設備行 / 隙間 / 列車行」を積んだ図式的な高さである。

const MARGIN_Y = 1;
export const FACILITY_ROW_HEIGHT = 8;
/** 設備行と列車行の隙間 */
export const GAP_Y = 2;
export const TRAIN_ROW_HEIGHT = 10;

/** ホーム帯（[0, physicalLength] の実体）の、列車のホーム側の端からの距離と太さ */
const PLATFORM_BAR_GAP = 0.3;
export const PLATFORM_BAR_HEIGHT = 0.6;
/** 両端ラベル（0m / physicalLength m）の文字サイズ */
export const PLATFORM_LABEL_FONT_SIZE = 1.6;
// text の y はベースラインなので、ラベルをホーム帯の外側に置くための距離は
// 上下で非対称になる（下側は文字の上端ぶん、上側は下端ぶんだけ余分に要る）。
const PLATFORM_LABEL_GAP_BELOW = 2.2;
const PLATFORM_LABEL_GAP_ABOVE = 1.4;

// ---- コンコース束ね線 ----
// 設備行のさらに外側（列車から遠い側）に、コンコース単位のアクセス点を束ねる線を引く。
// その先の出口名・乗換先ラベルはSVGの外（HTMLオーバーレイ）にあるので、
// SVGが確保するのは束ね線ぶんの高さだけであり、ラベルの件数では伸びない。

/** 設備アイコン行とブラケット横線の距離（＝縦ヒゲの長さ） */
export const CONCOURSE_TICK_HEIGHT = 2;

/**
 * 図を構成する3つの帯。SVGの外にあるHTMLオーバーレイ2つを含む。
 *
 * - `facing`  : 対面乗換バナー（ホームと反対側 ＝ 向かい側のホームがある方）
 * - `diagram` : SVG本体
 * - `plates`  : 出口・乗換プレート（ホーム側 ＝ 実際に改札へ歩いていく方）
 */
export type StripRow = 'facing' | 'diagram' | 'plates';

export type VerticalLayout = {
  /** SVG全体の高さ（viewBox の height）。束ね線の有無だけで決まり、ラベル件数では伸びない */
  viewHeight: number;
  /** 設備アイコン行の上端 */
  facilityY: number;
  /** 列車行の上端 */
  trainY: number;
  /** 対面乗換ティントの上端。ホーム側の帯全体（列車の端〜設備行の外端）を覆う */
  facingBandY: number;
  /** 対面乗換ティントの高さ */
  facingBandHeight: number;
  /** ホーム帯の上端（高さは PLATFORM_BAR_HEIGHT） */
  platformBarY: number;
  /** 両端ラベルのベースライン */
  platformLabelY: number;
  /** コンコース束ね線（横線）のy。束ね線が無い場合は null */
  concourseBracketY: number | null;
  /** 縦ヒゲの起点y（設備行の外側の端）。束ね線が無い場合は null */
  concourseTickStartY: number | null;
  /**
   * SVGとHTMLオーバーレイを上から並べる順序。
   *
   * オーバーレイをどちら側に置くかは platformSide 依存なので、ここで一手に決める。
   * 描画側は flex-direction: column のままこの順に描けばよく、
   * column-reverse のような side の再解釈をしてはならない。
   */
  stripOrder: StripRow[];
};

/**
 * platformSide（列車から見てホームがどちら側にあるか。schema: platform_side）から
 * 縦方向の座標と帯の並び順を一括で算出する（純関数）。
 *
 * 設備・ホーム帯・対面乗換ティント・コンコース束ね線はいずれもホーム上（またはその先）に
 * あるものなので、必ず列車行のホーム側にまとめて配置する。個別の描画箇所で side を
 * 解釈すると片方だけ反転し忘れ、要素が列車を挟んで散らばったり viewBox 外へ出たり
 * するため、side 依存の判断はすべてここで決める。SVG外のHTMLオーバーレイを
 * どちら側に積むか（stripOrder）も同じ理由でここが持つ。
 *
 * @param options.hasConcourseLeaders 束ね線を描くか。false のとき束ね線ぶんの高さは
 *   加算せず、viewHeight は束ね線導入前と完全に一致する。
 */
export function layoutRows(
  platformSide: 'top' | 'bottom' | null,
  options: { hasConcourseLeaders?: boolean } = {},
): VerticalLayout {
  const isTop = platformSide === 'top';
  const hasLeaders = options.hasConcourseLeaders ?? false;
  const concourseBlockHeight = hasLeaders ? CONCOURSE_TICK_HEIGHT : 0;
  const viewHeight =
    MARGIN_Y * 2 + FACILITY_ROW_HEIGHT + GAP_Y + TRAIN_ROW_HEIGHT + concourseBlockHeight;

  const facilityY = isTop
    ? MARGIN_Y + concourseBlockHeight
    : MARGIN_Y + TRAIN_ROW_HEIGHT + GAP_Y;
  const trainY = isTop ? facilityY + FACILITY_ROW_HEIGHT + GAP_Y : MARGIN_Y;
  // 列車行のホーム側の端。ホーム上の要素はすべてこれを基準に外向きへ配置する
  const platformEdge = isTop ? trainY : trainY + TRAIN_ROW_HEIGHT;
  // 設備行の外側の端。束ね線の縦ヒゲはここから伸びる
  const facilityOuterEdge = isTop ? facilityY : facilityY + FACILITY_ROW_HEIGHT;

  // 束ね線は設備行の外側端から CONCOURSE_TICK_HEIGHT だけ外側
  const bracketY = isTop
    ? facilityOuterEdge - CONCOURSE_TICK_HEIGHT
    : facilityOuterEdge + CONCOURSE_TICK_HEIGHT;

  // 対面乗換ティントはホーム側の帯全体（列車の端から設備行の外端まで）を覆う。
  // 「向かい側のホームに着く」のはホーム全体に関わる事実であり、
  // 列車行と設備行の隙間だけを塗ると、文字も入らない細い帯にしかならない。
  const facingBandY = Math.min(platformEdge, facilityOuterEdge);
  const facingBandHeight = Math.abs(facilityOuterEdge - platformEdge);

  return {
    viewHeight,
    facilityY,
    trainY,
    facingBandY,
    facingBandHeight,
    platformBarY: isTop
      ? platformEdge - PLATFORM_BAR_GAP - PLATFORM_BAR_HEIGHT
      : platformEdge + PLATFORM_BAR_GAP,
    platformLabelY: isTop
      ? platformEdge - PLATFORM_LABEL_GAP_ABOVE
      : platformEdge + PLATFORM_LABEL_GAP_BELOW,
    concourseBracketY: hasLeaders ? bracketY : null,
    concourseTickStartY: hasLeaders ? facilityOuterEdge : null,
    // ホーム側にプレート（出口・乗換）、反対側に対面乗換バナーを置く
    stripOrder: isTop ? ['plates', 'diagram', 'facing'] : ['facing', 'diagram', 'plates'],
  };
}
