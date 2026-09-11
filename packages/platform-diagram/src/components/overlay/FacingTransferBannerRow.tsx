import type { CSSProperties } from 'react';
import type { FacingTransferBanner } from '../../domain/concourseLayout';
import { xFraction, type Bounds } from '../../domain/geometry';

// 対面乗換のバナー。「向かい側に到着する」ことは帯を塗るだけでは伝わらないので、
// 文章として図の中に出す（東京メトロのホーム案内と同じ扱い）。
//
// バナーの左端は SVG 側のティントの左端と厳密に一致する。
// どちらも xFraction() で同じ割合に落ちるため、引き出し線を引かなくても
// 「この区間のことだ」が読み取れる。

/** インラインで路線色を渡すためのCSS変数付きスタイル（any を使わない） */
type LineColorStyle = CSSProperties & { '--line-color': string };

type Props = {
  banners: FacingTransferBanner[];
  laneCount: number;
  bounds: Bounds;
  /** 図がこのブロックの上にある（＝lane 0 を最初に描く）か */
  reverseLanes: boolean;
};

export function FacingTransferBannerRow({ banners, laneCount, bounds, reverseLanes }: Props) {
  if (banners.length === 0) return null;

  const lanes = Array.from({ length: laneCount }, (_, i) => (reverseLanes ? laneCount - 1 - i : i));

  return (
    <div
      className={`flex flex-col gap-1 ${reverseLanes ? 'pt-1.5' : 'pb-1.5'}`}
      style={{ fontFamily: 'var(--font-sign)' }}
    >
      {lanes.map((lane) => (
        <div key={lane} className="grid">
          {banners
            .filter((banner) => banner.lane === lane)
            .map((banner) => {
              const startPct = xFraction(banner.startX, bounds) * 100;
              const endPct = xFraction(banner.endX, bounds) * 100;
              const style: LineColorStyle = {
                gridArea: '1 / 1',
                justifySelf: 'start',
                marginInlineStart: `${startPct}%`,
                minWidth: `${endPct - startPct}%`,
                width: 'max-content',
                maxWidth: '100%',
                '--line-color': banner.color,
                // 色を主たる手掛かりにしない: color-mix が効かない環境でも
                // 左のバーだけで路線が識別できるようにする
                backgroundColor: 'color-mix(in srgb, var(--line-color) 10%, white)',
                borderInlineStart: '4px solid var(--line-color)',
              };

              return (
                <p
                  key={banner.key}
                  className="flex items-center gap-1.5 rounded-r-md py-1 pl-2 pr-2.5 text-[12px] font-bold leading-snug"
                  style={style}
                >
                  <span
                    aria-hidden
                    className="size-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: 'var(--line-color)' }}
                  />
                  {banner.text}
                </p>
              );
            })}
        </div>
      ))}
    </div>
  );
}
