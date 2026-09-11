import {
  CONCOURSE_TICK_HEIGHT,
  FACILITY_ROW_HEIGHT,
  PLATFORM_BAR_HEIGHT,
  PLATFORM_LABEL_FONT_SIZE,
  TRAIN_ROW_HEIGHT,
  type VerticalLayout,
} from '../../domain/geometry';
import type { ConcoursePlateGroup, FacingTransferBanner } from '../../domain/concourseLayout';
import { doorCentersX, freeSpaceMarks } from '../../domain/consist';
import { isDoorOrderReversed } from '../../domain/doorOrder';
import type { ConcourseDTO, StopPatternCarDTO } from '../../domain/types';

// 図の幾何だけを描く。文字はホーム両端の距離ラベルと号車番号しか持たない
// （出口名・路線名・対面乗換の文はSVG外のHTMLオーバーレイにある）。

// ファイル名だけを持つ。配信元は iconBasePath prop（既定 '/icons'）で決まる。
// public/ はアプリごとに独立配信されるため、このパッケージを使う各アプリが
// 自分の public/icons/ に同名ファイルを置く必要がある（README.md 参照）。
const FACILITY_ICON_FILES: Record<string, string> = {
  elevator: 'elevator.png',
  escalator: 'escalator.png',
  stairs: 'stairs.png',
  ramp: 'wheelchair_ramp.png',
  stairLift: 'stair_lift.png',
  sameFloor: 'wheelchair.png',
};

const ICON_SIZE = 6;
const NOSE_INSET_RATIO = 0.15;
/** 号車どうしの間に空ける隙間（片側）。境目をはっきりさせる */
const CAR_INSET = 0.4;
const CAR_CORNER_RADIUS = 0.6;
/** 乗車位置目標の三角形の幅 */
const BOARDING_MARK_WIDTH = 1.6;
const BOARDING_MARK_HEIGHT = 1.1;

type Props = {
  cars: StopPatternCarDTO[];
  concourses: ConcourseDTO[];
  physicalLength: number;
  minX: number;
  width: number;
  rows: VerticalLayout;
  plateGroups: ConcoursePlateGroup[];
  facingBanners: FacingTransferBanner[];
  /** 設備アイコンPNGの配信元パス。各アプリの public/icons/ を指す（既定 '/icons'） */
  iconBasePath?: string;
};

export function DiagramSvg({
  cars,
  concourses,
  physicalLength,
  minX,
  width,
  rows,
  plateGroups,
  facingBanners,
  iconBasePath = '/icons',
}: Props) {
  const reversed = isDoorOrderReversed(cars);
  const leadingCar = cars.find((c) => c.carNumber === 1) ?? cars[0];
  const trailingCar = cars.length > 1 ? cars[cars.length - 1] : undefined;
  const cells = concourses.flatMap((c) => c.cells.map((cell) => ({ ...cell, concourseId: c.id })));

  return (
    <svg
      viewBox={`${minX} 0 ${width} ${rows.viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      /* height を指定してはならない。指定すると meet がレターボックスを生み、
         HTMLオーバーレイとのx対応が無言で壊れる（docs/domain/platform-coordinate-system.md） */
      style={{ width: '100%', display: 'block' }}
    >
      {/* 対面乗換ティント。ホーム側の帯全体を覆う */}
      {facingBanners.map((banner) => (
        <rect
          key={banner.key}
          x={banner.startX}
          y={rows.facingBandY}
          width={banner.endX - banner.startX}
          height={rows.facingBandHeight}
          fill={banner.color}
          fillOpacity={0.14}
        >
          <title>{banner.text}</title>
        </rect>
      ))}

      {/* ホーム帯（[0, physicalLength] が実体） */}
      <rect
        x={0}
        y={rows.platformBarY}
        width={physicalLength}
        height={PLATFORM_BAR_HEIGHT}
        fill="var(--color-border-strong)"
      />
      <text x={0} y={rows.platformLabelY} fontSize={PLATFORM_LABEL_FONT_SIZE} fill="var(--color-text-secondary)">
        0m
      </text>
      <text
        x={physicalLength}
        y={rows.platformLabelY}
        fontSize={PLATFORM_LABEL_FONT_SIZE}
        fill="var(--color-text-secondary)"
        textAnchor="end"
      >
        {physicalLength}m
      </text>

      <CarRow cars={cars} leadingCar={leadingCar} trailingCar={trailingCar} reversed={reversed} trainY={rows.trainY} />
      <BoardingMarks cars={cars} reversed={reversed} rows={rows} />
      <FreeSpaceBadges cars={cars} reversed={reversed} rows={rows} />

      {/* 設備アクセス点（xPositionMeters が非nullのcellのみ。
          コンコース全体のものは座標が無いのでSVG外のリストに委ねる） */}
      {cells
        .filter((cell) => cell.xPositionMeters !== null)
        .map((cell, idx) =>
          cell.facilities.map((facility, fIdx) => {
            const x = cell.xPositionMeters! + (fIdx - (cell.facilities.length - 1) / 2) * (ICON_SIZE + 1);
            const iconFile = FACILITY_ICON_FILES[facility.typeCode];
            return iconFile ? (
              <image
                key={`${cell.concourseId}-${idx}-${fIdx}`}
                href={`${iconBasePath}/${iconFile}`}
                x={x - ICON_SIZE / 2}
                y={rows.facilityY + (FACILITY_ROW_HEIGHT - ICON_SIZE) / 2}
                width={ICON_SIZE}
                height={ICON_SIZE}
              >
                <title>{facility.typeName}</title>
              </image>
            ) : (
              <text
                key={`${cell.concourseId}-${idx}-${fIdx}`}
                x={x}
                y={rows.facilityY + FACILITY_ROW_HEIGHT / 2 + 1}
                fontSize={ICON_SIZE}
                textAnchor="middle"
              >
                📍
                <title>{facility.typeName}</title>
              </text>
            );
          }),
        )}

      <ConcourseLeaders groups={plateGroups} rows={rows} />
    </svg>
  );
}

function leadingCarPolygon(startMeters: number, endMeters: number, y: number, noseOnRight: boolean): string {
  const width = endMeters - startMeters;
  const inset = width * NOSE_INSET_RATIO;
  const bottom = y + TRAIN_ROW_HEIGHT;
  const mid = y + TRAIN_ROW_HEIGHT / 2;

  return noseOnRight
    ? `${startMeters},${y} ${endMeters - inset},${y} ${endMeters},${mid} ${endMeters - inset},${bottom} ${startMeters},${bottom}`
    : `${startMeters + inset},${y} ${endMeters},${y} ${endMeters},${bottom} ${startMeters + inset},${bottom} ${startMeters},${mid}`;
}

/**
 * 号車。1両ずつ独立した角丸矩形として描き、間に隙間を空けて境目を示す。
 *
 * 編成全体を1つの外枠で囲まないのは、号車が座標上で連続している保証が
 * データに無いため（管理画面の手入力）。隙間方式なら非連続でも破綻しない。
 */
function CarRow({
  cars,
  leadingCar,
  trailingCar,
  reversed,
  trainY,
}: {
  cars: StopPatternCarDTO[];
  leadingCar: StopPatternCarDTO | undefined;
  trailingCar: StopPatternCarDTO | undefined;
  reversed: boolean;
  trainY: number;
}) {
  return (
    <>
      {cars.map((car) => {
        const start = car.startMeters + CAR_INSET;
        const end = car.endMeters - CAR_INSET;
        const isLeading = leadingCar !== undefined && car.carNumber === leadingCar.carNumber;
        const isTrailing = trailingCar !== undefined && car.carNumber === trailingCar.carNumber;
        // 1号車が右端にあるなら、先頭のノーズは外向き（右）に出る
        const noseOnRight = isLeading ? reversed : !reversed;

        return (
          <g key={car.carNumber}>
            {isLeading || isTrailing ? (
              <polygon
                points={leadingCarPolygon(start, end, trainY, noseOnRight)}
                fill="var(--color-train-car-bg)"
                stroke="var(--color-train-car-border)"
                strokeWidth={0.2}
              />
            ) : (
              <rect
                x={start}
                y={trainY}
                width={end - start}
                height={TRAIN_ROW_HEIGHT}
                rx={CAR_CORNER_RADIUS}
                fill="var(--color-train-car-bg)"
                stroke="var(--color-train-car-border)"
                strokeWidth={0.2}
              />
            )}

            {/* 号車番号。車体が一様な色になったぶん、白バッジで浮かせる */}
            <rect
              x={(car.startMeters + car.endMeters) / 2 - 1.8}
              y={trainY + TRAIN_ROW_HEIGHT / 2 - 1.8}
              width={3.6}
              height={3.6}
              rx={0.9}
              fill="var(--color-car-number-bg)"
            />
            <text
              x={(car.startMeters + car.endMeters) / 2}
              y={trainY + TRAIN_ROW_HEIGHT / 2 + 0.8}
              fontSize={2.4}
              fontWeight="bold"
              textAnchor="middle"
              fill="var(--color-text-primary)"
              style={{ fontFamily: 'var(--font-sign)', fontVariantNumeric: 'tabular-nums' }}
            >
              {car.carNumber}
            </text>
          </g>
        );
      })}
    </>
  );
}

/**
 * 乗車位置目標。ホーム帯の外側に、実際のドア座標に合わせて打つ。
 *
 * フリースペースのあるドアだけ色を付けて印を強くする。
 * 号車を色で塗り分けるのをやめたのは、号車の境目を潰すうえ、
 * 凡例を読まないと何の色か分からなかったため。「ここに立て」を直接示すほうが早い。
 */
function BoardingMarks({
  cars,
  reversed,
  rows,
}: {
  cars: StopPatternCarDTO[];
  reversed: boolean;
  rows: VerticalLayout;
}) {
  const platformIsAbove = rows.facilityY < rows.trainY;
  // ホーム帯の、列車から見て外側の面にマークを載せる
  const baseY = platformIsAbove ? rows.platformBarY : rows.platformBarY + PLATFORM_BAR_HEIGHT;
  const tipY = platformIsAbove ? baseY - BOARDING_MARK_HEIGHT : baseY + BOARDING_MARK_HEIGHT;

  const triangle = (x: number) =>
    `${x - BOARDING_MARK_WIDTH / 2},${baseY} ${x + BOARDING_MARK_WIDTH / 2},${baseY} ${x},${tipY}`;

  return (
    <>
      {cars.map((car) => {
        const free = freeSpaceMarks(car, reversed);
        const freeByX = new Map(free.map((mark) => [mark.x, mark.isStandard]));

        return (
          <g key={car.carNumber}>
            {doorCentersX(car).map((x) => {
              const isStandard = freeByX.get(x);
              const isFree = isStandard !== undefined;
              return (
                <polygon
                  key={x}
                  points={triangle(x)}
                  fill={
                    !isFree
                      ? 'var(--sign-boarding-mark)'
                      : isStandard
                        ? 'var(--color-free-standard)'
                        : 'var(--color-free-nonstandard)'
                  }
                  fillOpacity={isFree ? 1 : 0.55}
                />
              );
            })}
          </g>
        );
      })}
    </>
  );
}

/**
 * フリースペースの記号を、そのドアの真上（号車の中、ホーム側の縁）に置く。
 *
 * 設備アイコン行に置くと、エレベーターや階段のアイコンと重なって両方読めなくなる。
 * 号車の中なら、どの号車のどのドアかが一目で結びつく。
 */
function FreeSpaceBadges({
  cars,
  reversed,
  rows,
}: {
  cars: StopPatternCarDTO[];
  reversed: boolean;
  rows: VerticalLayout;
}) {
  const platformIsAbove = rows.facilityY < rows.trainY;
  const cy = platformIsAbove ? rows.trainY + 2.4 : rows.trainY + TRAIN_ROW_HEIGHT - 2.4;

  return (
    <>
      {cars.flatMap((car) =>
        freeSpaceMarks(car, reversed).map((mark) => {
          const color = mark.isStandard
            ? 'var(--color-free-standard)'
            : 'var(--color-free-nonstandard)';
          const ink = mark.isStandard
            ? 'var(--color-free-standard-text)'
            : 'var(--color-free-nonstandard-text)';

          return (
            <g key={`${car.carNumber}-${mark.doorNumber}`}>
              <circle cx={mark.x} cy={cy} r={1.9} fill={color} />
              <FreeSpaceGlyph x={mark.x} y={cy} color={ink} />
              <title>
                {car.carNumber}号車 {mark.doorNumber}番ドア付近のフリースペース
                {mark.isStandard ? '（全編成）' : '（一部編成）'}
              </title>
            </g>
          );
        }),
      )}
    </>
  );
}

/**
 * フリースペースの記号。
 *
 * public/icons/ に専用のアイコンが無く、wheelchair.png は「段差なし」で
 * 使用済みなので流用すると意味が衝突する。ベクタで小さく描き起こす
 * （5px/m では画像を置いても潰れる）。
 */
function FreeSpaceGlyph({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x - 1.2}, ${y - 1.2}) scale(0.1)`} fill={color} aria-hidden>
      <circle cx={9} cy={4} r={3} />
      <path d="M6 8 h6 a2 2 0 0 1 2 2 v6 h-3 v6 h-4 v-6 h-3 v-6 a2 2 0 0 1 2 -2 z" />
    </g>
  );
}

/** コンコース束ね線。同一コンコースのアクセス点をまとめ、その先のプレートへ垂線を落とす */
function ConcourseLeaders({ groups, rows }: { groups: ConcoursePlateGroup[]; rows: VerticalLayout }) {
  if (rows.concourseBracketY === null || rows.concourseTickStartY === null) return null;
  const bracketY = rows.concourseBracketY;
  const tickStartY = rows.concourseTickStartY;
  // 束ね線からSVGの端まで。この先はHTMLオーバーレイのプレートが受ける
  const edgeY = rows.facilityY < rows.trainY ? 0 : rows.viewHeight;

  return (
    <g stroke="var(--sign-leader)" strokeWidth={0.25} fill="none">
      {groups.map((group) => (
        <g key={group.concourseId}>
          {group.tickXs.map((x) => (
            <line key={x} x1={x} y1={tickStartY} x2={x} y2={bracketY} />
          ))}
          {group.bracketStartX !== group.bracketEndX && (
            <line x1={group.bracketStartX} y1={bracketY} x2={group.bracketEndX} y2={bracketY} />
          )}
          {/* プレートは anchorX を中心に置かれるので、引き出し線は垂直でよい */}
          <line
            x1={group.anchorX}
            y1={bracketY}
            x2={group.anchorX}
            y2={edgeY}
            strokeWidth={CONCOURSE_TICK_HEIGHT * 0.12}
          />
        </g>
      ))}
    </g>
  );
}
