import type { ReactNode } from 'react';
import { PX_PER_METER, layoutRows, type Bounds, type VerticalLayout } from '../domain/geometry';
import type { ConcoursePlateLayout, FacingTransferLayout } from '../domain/concourseLayout';
import type { ConcourseDTO, TrainStopPatternDTO } from '../domain/types';
import { DiagramSvg } from './diagram/DiagramSvg';
import { ConcoursePlateRow } from './overlay/ConcoursePlateRow';
import { FacingTransferBannerRow } from './overlay/FacingTransferBannerRow';

// 停車位置パターン1件ぶんのカード。
//
// 図は「SVGの幾何」と「HTMLのオーバーレイ2枚」の3層でできており、
// 3層すべてが同じキャンバス（幅 = 描画範囲 × PX_PER_METER）の上に乗る。
// 層をまたぐxの対応は xFraction() の割合で取るので、キャンバスが
// コンテナ幅まで伸びても対応は崩れない。docs/adr/0006 参照。

type Props = {
  pattern: TrainStopPatternDTO;
  physicalLength: number;
  concourses: ConcourseDTO[];
  platformSide: 'top' | 'bottom' | null;
  bounds: Bounds;
  /** 出口・乗換プレートの配置。ホーム単位で決まるので PlatformDisplay で算出する */
  plateLayout: ConcoursePlateLayout;
  /** 対面乗換バナーの配置。同上 */
  facingLayout: FacingTransferLayout;
  /** 設備アイコンPNGの配信元パス。DiagramSvg にそのまま渡す（既定 '/icons'） */
  iconBasePath?: string;
  /**
   * 編集レイヤ（admin の DiagramEditLayer）の差し込み口。SVGの要素ボックスと
   * 完全に一致する `relative` ラッパの中に絶対配置で重なる。実際に使った rows を
   * そのまま渡すので、呼び出し側で layoutRows() を再計算する必要が無い。
   * web は未指定のまま（挙動不変）。
   */
  diagramOverlay?: (rows: VerticalLayout) => ReactNode;
};

export function PlatformDiagram({
  pattern,
  physicalLength,
  concourses,
  platformSide,
  bounds,
  plateLayout,
  facingLayout,
  iconBasePath,
  diagramOverlay,
}: Props) {
  const { minX, maxX } = bounds;
  const width = maxX - minX;
  const cars = [...pattern.cars].sort((a, b) => a.carNumber - b.carNumber);
  const rows = layoutRows(platformSide, { hasConcourseLeaders: plateLayout.groups.length > 0 });

  // lane 0 は図に最も近い段。図の手前に積む側（top側）では、段を逆順に描かないと
  // lane 0 が図から最も遠くなってしまう。platformSide を読み直すのではなく、
  // layoutRows() が返した並び順から導く（side の解釈は layoutRows() に一本化する）
  const diagramIndex = rows.stripOrder.indexOf('diagram');
  const platesReversed = rows.stripOrder.indexOf('plates') < diagramIndex;
  const facingReversed = rows.stripOrder.indexOf('facing') < diagramIndex;

  const strip = {
    facing: (
      <FacingTransferBannerRow
        key="facing"
        banners={facingLayout.banners}
        laneCount={facingLayout.laneCount}
        bounds={bounds}
        reverseLanes={facingReversed}
      />
    ),
    diagram: (
      // relative 以外のクラスを足さないこと。h-full やgridのstretchを与えると
      // SVGの要素ボックスがviewBoxのアスペクト比から外れ、内部の絶対配置オーバーレイの
      // y座標が実測pxとずれる（x はxFractionの割合なので影響しない）。
      <div key="diagram" className="relative">
        <DiagramSvg
          cars={cars}
          concourses={concourses}
          physicalLength={physicalLength}
          minX={minX}
          width={width}
          rows={rows}
          plateGroups={plateLayout.groups}
          facingBanners={facingLayout.banners}
          iconBasePath={iconBasePath}
        />
        {diagramOverlay?.(rows)}
      </div>
    ),
    plates: (
      <ConcoursePlateRow
        key="plates"
        groups={plateLayout.groups}
        laneCount={plateLayout.laneCount}
        bounds={bounds}
        reverseLanes={platesReversed}
      />
    ),
  };

  return (
    <div
      className="rounded-3xl border-2 p-6"
      style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border-default)' }}
    >
      {/* 列車名 */}
      <div className="mb-4 pb-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
        <h5 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {pattern.trainLabel}
        </h5>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {pattern.carCount}両編成
        </p>
      </div>

      <div className="mb-2 overflow-x-auto">
        {/* キャンバス。min-width（width ではない）にすることで、コンテナが広いときは
            伸びて余白を埋め、狭いときは横スクロールになる。伸縮しても各層は
            割合で位置を決めているのでxがずれない */}
        <div className="flex flex-col" style={{ minWidth: width * PX_PER_METER }}>
          {/* 並び順は layoutRows() が platformSide から決める。
              ここで column-reverse などを使って side を再解釈してはならない */}
          {rows.stripOrder.map((row) => strip[row])}
        </div>
      </div>

      {/* 凡例 */}
      <div
        className="grid grid-cols-2 gap-2 pt-3 text-xs md:grid-cols-3"
        style={{ borderTop: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)' }}
      >
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-shrink-0">
            <polygon points="4,11 12,11 8,5" fill="var(--color-free-standard)" />
          </svg>
          <span>フリースペース</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-shrink-0">
            <polygon points="4,11 12,11 8,5" fill="var(--color-free-nonstandard)" />
          </svg>
          <span>(一部編成)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-shrink-0">
            <polygon points="4,11 12,11 8,5" fill="var(--sign-boarding-mark)" fillOpacity="0.55" />
          </svg>
          <span>乗車位置</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-4 w-4 flex-shrink-0 rounded-sm"
            style={{ backgroundColor: 'var(--sign-exit-bg)', border: '1px solid var(--sign-exit-edge)' }}
          />
          <span>出口</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-4 w-4 flex-shrink-0 rounded-sm"
            style={{ backgroundColor: 'var(--sign-transfer-bg)', border: '2px solid var(--sign-transfer-edge)' }}
          />
          <span>乗換</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-shrink-0">
            <path d="M3 13 V7 H13 V13" fill="none" stroke="var(--sign-leader)" strokeWidth="1.5" />
          </svg>
          <span>同じ出口・乗換へ</span>
        </div>
      </div>

      {/* フリースペース詳細。図はドア位置を示すが、号車とドア番号の一覧は
          読み上げ・テキスト検索のために残す（車両情報ページができるまでの受け皿でもある） */}
      {cars.some((c) => c.freeSpaceDoors.length > 0) && (
        <div
          className="mt-3 rounded-2xl border p-3 text-xs"
          style={{ backgroundColor: 'var(--card-transfer-bg)', borderColor: 'var(--card-transfer-border)' }}
        >
          <strong className="flex items-center gap-1" style={{ color: 'var(--card-transfer-heading)' }}>
            <span className="text-sm">ℹ️</span> フリースペース詳細
          </strong>
          <ul className="mt-1.5 ml-5 space-y-0.5" style={{ color: 'var(--color-text-primary)' }}>
            {cars.flatMap((c) =>
              c.freeSpaceDoors.map((fs, idx) => (
                <li key={`${c.carNumber}-${idx}`}>
                  {c.carNumber}号車 {fs.nearDoor}番ドア付近
                  {fs.isStandard ? ' (全編成)' : ' (一部編成)'}
                </li>
              )),
            )}
          </ul>
        </div>
      )}

      {/* 優先席は乗ってから探すもので立ち位置を左右しないため図には出さないが、
          情報は失わせない（車両情報ページの新設までここが受け皿） */}
      {cars.some((c) => c.prioritySeatDoors.length > 0) && (
        <div
          className="mt-2 rounded-2xl border p-3 text-xs"
          style={{ backgroundColor: 'var(--card-prio-bg)', borderColor: 'var(--card-prio-border)' }}
        >
          <strong className="flex items-center gap-1" style={{ color: 'var(--card-prio-heading)' }}>
            <span className="text-sm">ℹ️</span> 優先席
          </strong>
          <ul className="mt-1.5 ml-5 space-y-0.5" style={{ color: 'var(--color-text-primary)' }}>
            {cars.flatMap((c) =>
              c.prioritySeatDoors.map((ps, idx) => (
                <li key={`${c.carNumber}-${idx}`}>
                  {c.carNumber}号車 {ps.nearDoor}番ドア付近
                </li>
              )),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
