import {
  type TransferEntry,
  directionPhrase,
  exitsLabel,
  facingTransferText,
  primaryLineColor,
  transferEntries,
} from './concourse';
import { PX_PER_METER, type Bounds, xFraction } from './geometry';
import { assignLanes, laneCount } from './lanes';
import type { ConcourseDTO } from './types';

// 出口・乗換プレートと対面乗換バナーを、ホーム座標系のどこに置くかを決める。
//
// プレートの中身は SVG ではなく HTML なので、**文字を切り詰めない**。
// ここが決めるのはアンカー位置と段の割り当てだけで、実際の幅と高さは
// ブラウザのCSSが決める（docs/adr/0006）。幅の見積りは段の割り当てに使うだけであり、
// 外しても「プレートがやや近づく」以上のことは起きない。

/** プレート1枚の最大幅。これを超える文字は折り返す（切らない） */
export const PLATE_MAX_WIDTH_PX = 220;
/** プレート1枚の最小幅。短い出口名でも潰れないようにする */
export const PLATE_MIN_WIDTH_PX = 96;
/** 同じ段に並ぶプレートどうしの最小間隔。幅の見積り誤差もここで吸収する */
export const PLATE_GAP_PX = 10;
/** 幅の見積りに使う文字サイズ。CSS 側の .plate の font-size と揃える */
export const PLATE_FONT_SIZE_PX = 13;
/** プレートの左右パディングと枠線の合計 */
export const PLATE_PADDING_PX = 20;
/** 路線カラーチップとその右の余白 */
export const LINE_CHIP_WIDTH_PX = 16;

/** プレートを描画範囲のどちら端に寄せるか。中央配置がはみ出すときだけ端に寄せる */
export type PlateAlign = 'start' | 'center' | 'end';

export type ConcoursePlateGroup = {
  concourseId: string;
  /** 縦ヒゲを下ろすx（座標を持つアクセス点。メートル・昇順・重複除去） */
  tickXs: number[];
  /** 束ね線の範囲（メートル）。tickXs が1件のときは start === end となり横線は引かない */
  bracketStartX: number;
  bracketEndX: number;
  /** 束ね線の中点（メートル）。引き出し線の起点であり、クランプしない */
  anchorX: number;
  /** 段番号。0 が図に最も近い */
  lane: number;
  align: PlateAlign;
  /** 出口名。全文（省略しない）。未入力なら null */
  exit: string | null;
  /** 乗換先。全件（省略しない） */
  transfers: TransferEntry[];
  /** このコンコースに属する設備の種別名。プレート見出しに添えて束ね線との対応を文章で担保する */
  facilityTypeNames: string[];
};

export type ConcoursePlateLayout = {
  /** anchorX 昇順 */
  groups: ConcoursePlateGroup[];
  laneCount: number;
};

export type FacingTransferBanner = {
  key: string;
  /** 対面乗換の範囲（メートル）。両端とも非nullの接続のみが対象 */
  startX: number;
  endX: number;
  lane: number;
  color: string;
  text: string;
};

export type FacingTransferLayout = {
  banners: FacingTransferBanner[];
  laneCount: number;
};

/**
 * 全角を1em、半角を0.5emとして文字列の描画幅を概算する。
 *
 * **段の割り当ての判断にのみ使う。切り詰めには使わない。**
 * 全角・半角の二値でしか見ておらず、実際の字送り（プロポーショナル幅・カーニング）は
 * 再現しない。誤差は PLATE_GAP_PX の余白と CSS の折り返しが吸収する。
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text) {
    em += isFullWidth(char.codePointAt(0)!) ? 1 : 0.5;
  }
  return em * fontSize;
}

function isFullWidth(codePoint: number): boolean {
  if (codePoint <= 0xff) return false; // ASCII / Latin-1
  if (codePoint >= 0xff61 && codePoint <= 0xffdc) return false; // 半角カナ
  if (codePoint >= 0xffe8 && codePoint <= 0xffee) return false; // 半角記号
  return true;
}

/**
 * 各コンコースのプレート配置を決める（純関数）。
 *
 * 座標を持つアクセス点が1つも無いコンコースは束ね線を引けないため対象外とする
 * （PlatformDisplay 下部のテキストリストに委ねる）。
 */
export function layoutConcoursePlates(
  concourses: ConcourseDTO[],
  bounds: Bounds,
): ConcoursePlateLayout {
  const canvasWidthPx = (bounds.maxX - bounds.minX) * PX_PER_METER;

  const candidates = concourses
    .map((concourse) => buildGroup(concourse, bounds, canvasWidthPx))
    .filter((group): group is BuiltGroup => group !== null);

  const placed = assignLanes(candidates, PLATE_GAP_PX);
  // startPx / endPx はレーン割り当てのための内部値なので、外へは出さない
  const groups: ConcoursePlateGroup[] = placed
    .map((group) => ({
      concourseId: group.concourseId,
      tickXs: group.tickXs,
      bracketStartX: group.bracketStartX,
      bracketEndX: group.bracketEndX,
      anchorX: group.anchorX,
      lane: group.lane,
      align: group.align,
      exit: group.exit,
      transfers: group.transfers,
      facilityTypeNames: group.facilityTypeNames,
    }))
    .sort((a, b) => a.anchorX - b.anchorX);

  return { groups, laneCount: laneCount(placed) };
}

type BuiltGroup = Omit<ConcoursePlateGroup, 'lane'> & { startPx: number; endPx: number };

function buildGroup(
  concourse: ConcourseDTO,
  bounds: Bounds,
  canvasWidthPx: number,
): BuiltGroup | null {
  const tickXs = [
    ...new Set(
      concourse.cells
        .map((cell) => cell.xPositionMeters)
        .filter((x): x is number => x !== null),
    ),
  ].sort((a, b) => a - b);
  if (tickXs.length === 0) return null;

  const exit = exitsLabel(concourse);
  const transfers = transferEntries(concourse);
  if (exit === null && transfers.length === 0) return null;

  // 直上の length === 0 ガードにより両端は必ず存在する
  const bracketStartX = tickXs[0]!;
  const bracketEndX = tickXs[tickXs.length - 1]!;
  const anchorX = (bracketStartX + bracketEndX) / 2;

  const estWidthPx = estimatePlateWidth(exit, transfers);
  const anchorPx = xFraction(anchorX, bounds) * canvasWidthPx;

  // 中央配置したときの左端。キャンバスからはみ出すぶんは端に寄せる。
  // はみ出したままだと、左は切り落とされ、右はスクロール領域を無駄に広げる。
  const centeredLeft = anchorPx - estWidthPx / 2;
  const align: PlateAlign =
    centeredLeft < 0 ? 'start' : centeredLeft + estWidthPx > canvasWidthPx ? 'end' : 'center';
  const startPx =
    align === 'start' ? 0 : align === 'end' ? canvasWidthPx - estWidthPx : centeredLeft;

  return {
    concourseId: concourse.id,
    tickXs,
    bracketStartX,
    bracketEndX,
    anchorX,
    align,
    exit,
    transfers,
    facilityTypeNames: [
      ...new Set(concourse.cells.flatMap((cell) => cell.facilities.map((f) => f.typeName))),
    ],
    startPx,
    endPx: startPx + estWidthPx,
  };
}

/**
 * プレートの幅を見積もる。最も長い行の幅を採り、最小・最大幅で挟む。
 *
 * 収まらない行は CSS が折り返すので、ここでの過小評価は
 * 「プレートが縦に伸びる」だけで済む（文字は1文字も失われない）。
 */
function estimatePlateWidth(exit: string | null, transfers: TransferEntry[]): number {
  const lineWidths: number[] = [];

  if (exit !== null) {
    lineWidths.push(estimateTextWidth(exit, PLATE_FONT_SIZE_PX));
  }
  for (const transfer of transfers) {
    for (const line of transfer.lines) {
      lineWidths.push(estimateTextWidth(line.name, PLATE_FONT_SIZE_PX) + LINE_CHIP_WIDTH_PX);
    }
    const note = transferNote(transfer);
    if (note !== null) {
      lineWidths.push(estimateTextWidth(note, PLATE_FONT_SIZE_PX));
    }
  }

  const widest = lineWidths.length > 0 ? Math.max(...lineWidths) : 0;
  return Math.min(
    PLATE_MAX_WIDTH_PX,
    Math.max(PLATE_MIN_WIDTH_PX, widest + PLATE_PADDING_PX),
  );
}

/**
 * 乗換プレートの補助行。路線名の下に添える「駅名・方面・備考」。
 *
 * 路線が1件も引けない接続では駅名が唯一の手掛かりになるので必ず出す。
 * 引ける場合は駅名を省き、方面と備考だけを添える（路線名で駅は察しがつく）。
 */
export function transferNote(transfer: TransferEntry): string | null {
  const parts = [
    transfer.lines.length === 0 ? transfer.stationName : null,
    transfer.directionName ? directionPhrase(transfer.directionName) : null,
    transfer.exitLabel,
  ].filter((part): part is string => part !== null && part !== '');

  return parts.length > 0 ? parts.join('・') : null;
}

/**
 * 対面乗換バナーの配置を決める（純関数）。
 *
 * 座標範囲の両端が揃っている接続だけが対象。片方でも欠けていれば
 * ホーム上のどこを指すか決まらないので、図には出さずテキストに委ねる。
 */
export function layoutFacingBanners(
  concourses: ConcourseDTO[],
  bounds: Bounds,
): FacingTransferLayout {
  const canvasWidthPx = (bounds.maxX - bounds.minX) * PX_PER_METER;

  const candidates = concourses.flatMap((concourse) =>
    concourse.connections
      .filter((conn) => conn.xRangeStart !== null && conn.xRangeEnd !== null)
      .map((conn, index) => {
        const startX = Math.min(conn.xRangeStart!, conn.xRangeEnd!);
        const endX = Math.max(conn.xRangeStart!, conn.xRangeEnd!);
        const text = facingTransferText(conn);
        const startPx = xFraction(startX, bounds) * canvasWidthPx;

        return {
          key: `${concourse.id}-${index}`,
          startX,
          endX,
          color: primaryLineColor(conn),
          text,
          startPx,
          // 帯より文が長ければ文の幅が占有幅になる。重なり判定はその広い方で見る
          endPx: Math.max(
            xFraction(endX, bounds) * canvasWidthPx,
            startPx + estimateTextWidth(text, PLATE_FONT_SIZE_PX),
          ),
        };
      }),
  );

  const placed = assignLanes(candidates, PLATE_GAP_PX);
  const banners: FacingTransferBanner[] = placed
    .map((banner) => ({
      key: banner.key,
      startX: banner.startX,
      endX: banner.endX,
      lane: banner.lane,
      color: banner.color,
      text: banner.text,
    }))
    .sort((a, b) => a.startX - b.startX);

  return { banners, laneCount: laneCount(placed) };
}
