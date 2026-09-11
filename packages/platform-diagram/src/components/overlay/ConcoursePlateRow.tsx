import type { CSSProperties } from 'react';
import { transferNote, type ConcoursePlateGroup } from '../../domain/concourseLayout';
import type { TransferEntry } from '../../domain/concourse';
import { xFraction, type Bounds } from '../../domain/geometry';

// 出口・乗換のプレート。SVGではなくHTMLなので、文字は折り返すだけで一切切り詰めない。
//
// 各レーンは「単一セルの grid」にしてある。同じセルに置かれた grid item は
// 全員が行の高さに寄与するので、レーンの高さが中身に合わせて自動で決まる。
// 絶対配置だと高さに寄与せず、行高をサーバ側で推定する羽目になり、
// 推定を外した瞬間に段が重なって読めなくなる（docs/adr/0006）。

type Props = {
  groups: ConcoursePlateGroup[];
  laneCount: number;
  bounds: Bounds;
  /** 図がこのブロックの下にある（＝lane 0 を最後に描く）か */
  reverseLanes: boolean;
};

/** アンカーのx割合をCSSのパーセントに写す */
function percentOf(x: number, bounds: Bounds): string {
  return `${xFraction(x, bounds) * 100}%`;
}

/**
 * プレートの水平位置。
 *
 * 中央寄せは「アンカーを中心に置く」＝ margin で左端まで送ってから半分戻す。
 * 端に寄せる場合は translate を打ち消す（左は切り落とされ、右はスクロール領域を
 * 無駄に広げるため、はみ出させない）。
 */
function plateStyle(group: ConcoursePlateGroup, bounds: Bounds): CSSProperties {
  if (group.align === 'start') return { marginInlineStart: 0 };
  if (group.align === 'end') return { marginInlineStart: 'auto', justifySelf: 'end' };
  return { marginInlineStart: percentOf(group.anchorX, bounds), transform: 'translateX(-50%)' };
}

export function ConcoursePlateRow({ groups, laneCount, bounds, reverseLanes }: Props) {
  if (groups.length === 0) return null;

  // lane 0 が常に図に接するように並べる
  const lanes = Array.from({ length: laneCount }, (_, i) => (reverseLanes ? laneCount - 1 - i : i));

  return (
    <div className="flex flex-col" style={{ fontFamily: 'var(--font-sign)' }}>
      {lanes.map((lane) => (
        <div key={lane} className="grid">
          {/* 支柱: このレーンより深いプレートへ垂線を通す。
              高さ0の要素を stretch させるので行サイズには影響しない */}
          {groups
            .filter((group) => group.lane > lane)
            .map((group) => (
              <div
                key={`stem-${group.concourseId}`}
                aria-hidden
                className="w-0.5 self-stretch"
                style={{
                  gridArea: '1 / 1',
                  marginInlineStart: percentOf(group.anchorX, bounds),
                  transform: 'translateX(-50%)',
                  backgroundColor: 'var(--sign-leader)',
                }}
              />
            ))}

          {groups
            .filter((group) => group.lane === lane)
            .map((group) => (
              <div
                key={group.concourseId}
                className={`flex flex-col gap-1 ${reverseLanes ? 'pb-1.5' : 'pt-1.5'}`}
                style={{
                  gridArea: '1 / 1',
                  justifySelf: 'start',
                  // max-content の明示は必須。省略すると fit-content になり、
                  // 右寄りのプレートが「残り幅」に潰されて過剰に折り返す
                  width: 'max-content',
                  maxWidth: 'min(220px, 100%)',
                  ...plateStyle(group, bounds),
                }}
              >
                {group.exit !== null && (
                  <ExitPlate exit={group.exit} facilityTypeNames={group.facilityTypeNames} />
                )}
                {group.transfers.length > 0 && <TransferPlate transfers={group.transfers} />}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

/**
 * 出口プレート（黄地に黒）。
 *
 * 設備の種別名を添えるのは、束ね線と出口の対応を**文章でも**担保するため。
 * 引き出し線は幅の見積り誤差ぶんずれうるが、「このエレベーターは中央改札へ」が
 * 文字で読めれば対応関係は失われない。
 */
function ExitPlate({ exit, facilityTypeNames }: { exit: string; facilityTypeNames: string[] }) {
  return (
    <div
      className="rounded-md px-2.5 py-1.5 text-[13px] font-bold leading-snug"
      style={{
        backgroundColor: 'var(--sign-exit-bg)',
        color: 'var(--sign-exit-ink)',
        border: '1px solid var(--sign-exit-edge)',
      }}
    >
      {exit}
      {facilityTypeNames.length > 0 && (
        <span className="mt-0.5 block text-[11px] font-normal opacity-75">
          {facilityTypeNames.join('・')}から
        </span>
      )}
    </div>
  );
}

/** 乗換プレート（白地に黒枠）。路線は1件ずつ色チップ付きで縦に並べ、畳まない */
function TransferPlate({ transfers }: { transfers: TransferEntry[] }) {
  return (
    <div
      className="rounded-md px-2.5 py-1.5 text-[13px] leading-snug"
      style={{
        backgroundColor: 'var(--sign-transfer-bg)',
        color: 'var(--sign-transfer-ink)',
        border: '2px solid var(--sign-transfer-edge)',
      }}
    >
      <ul className="flex flex-col gap-1">
        {transfers.map((transfer, index) => {
          const note = transferNote(transfer);
          return (
            <li key={index} className="flex flex-col gap-0.5">
              {transfer.lines.map((line) => (
                <span key={line.name} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: line.color }}
                  />
                  {line.name}
                </span>
              ))}
              {note !== null && (
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--sign-transfer-note)' }}
                >
                  {note}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
