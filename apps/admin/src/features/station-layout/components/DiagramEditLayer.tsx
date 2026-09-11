'use client';

import {
  useCallback, useEffect, useRef, useState, type RefObject,
} from 'react';
import {
  pxToMeters, snapMeters, roundToDecimal2, snapCandidates,
  SNAP_GRID_METERS, SNAP_TOLERANCE_METERS,
  FACILITY_ROW_HEIGHT, TRAIN_ROW_HEIGHT,
  type Bounds, type VerticalLayout, type StopPatternCarDTO,
} from '@furatora/platform-diagram/domain';

// PlatformDiagram の diagramOverlay に差し込む編集レイヤ。
// SVGの再レイアウトは行わず、既存の描画結果の上に絶対配置のハンドルを重ねるだけ
// （ADR-0010 決定2）。ドラッグstate・Alt検出・bounds凍結はここ（admin側）が持つ。
// packages/platform-diagram の snap.ts は純関数のみを提供する。

const HANDLE_SIZE_PX = 24;
// 号車を潰さない最小幅。グリッド幅を流用する（新たな定数を増やさない）
const MIN_CAR_METERS = SNAP_GRID_METERS;
const KEYBOARD_FINE_STEP_METERS = 0.1;

type CarLike = Pick<StopPatternCarDTO, 'carNumber' | 'startMeters' | 'endMeters' | 'doorCount'>;

export type CellHandleData = { id: string; xPositionMeters: number };

type Props = {
  rows: VerticalLayout;
  bounds: Bounds;
  physicalLength: number;
  cars: CarLike[];
  /** xPositionMeters === null のセルは図に描けないため、ここには渡さない（呼び出し側でフィルタ済み） */
  cellHandles: CellHandleData[];
  selectedCellId: string | null;
  onSelectCell: (cellId: string) => void;
  onMoveCell: (cellId: string, x: number) => void;
  onMoveCarBoundary: (boundaryIndex: number, x: number) => void;
  onMoveCarEdge: (edge: { carNumber: number; side: 'start' | 'end' }, x: number) => void;
};

/** キャンバス（このレイヤーのルート要素）の実測サイズ。min-widthで伸縮するため必ず実測する */
function useCanvasRect(rootRef: RefObject<HTMLDivElement | null>) {
  const [rect, setRect] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ width: r.width, height: r.height });
    };
    update();
    // jsdomにResizeObserverは無い。テスト環境では初回のgetBoundingClientRectのみで足りる
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootRef]);

  return rect;
}

export function DiagramEditLayer({
  rows, bounds, physicalLength, cars, cellHandles, selectedCellId,
  onSelectCell, onMoveCell, onMoveCarBoundary, onMoveCarEdge,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rect = useCanvasRect(rootRef);
  const sortedCars = [...cars].sort((a, b) => a.carNumber - b.carNumber);

  const cellY = rows.facilityY + FACILITY_ROW_HEIGHT / 2;
  const carY = rows.trainY + TRAIN_ROW_HEIGHT / 2;

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0">
      {cellHandles.map((cell) => (
        <DragHandle
          key={cell.id}
          rootRef={rootRef}
          rect={rect}
          bounds={bounds}
          rows={rows}
          x={cell.xPositionMeters}
          y={cellY}
          label={`アクセス点（${cell.xPositionMeters}m）`}
          selected={cell.id === selectedCellId}
          onFocus={() => onSelectCell(cell.id)}
          candidates={() => snapCandidates(sortedCars, physicalLength, { exclude: [cell.xPositionMeters] })}
          onCommit={(x) => onMoveCell(cell.id, x)}
        />
      ))}

      {sortedCars.map((car, i) => {
        const isFirst = i === 0;
        const isLast = i === sortedCars.length - 1;
        return (
          <div key={car.carNumber}>
            {isFirst && (
              <DragHandle
                rootRef={rootRef}
                rect={rect}
                bounds={bounds}
                rows={rows}
                x={car.startMeters}
                y={carY}
                label={`${car.carNumber}号車の先頭（${car.startMeters}m）`}
                selected={false}
                candidates={() => snapCandidates(sortedCars, physicalLength, { exclude: [car.startMeters] })}
                onCommit={(x) => onMoveCarEdge(
                  { carNumber: car.carNumber, side: 'start' },
                  Math.min(x, car.endMeters - MIN_CAR_METERS),
                )}
              />
            )}
            {!isLast && (
              <DragHandle
                rootRef={rootRef}
                rect={rect}
                bounds={bounds}
                rows={rows}
                x={car.endMeters}
                y={carY}
                label={`${car.carNumber}号車と${car.carNumber + 1}号車の境界（${car.endMeters}m）`}
                selected={false}
                candidates={() => snapCandidates(sortedCars, physicalLength, { exclude: [car.endMeters] })}
                onCommit={(x) => onMoveCarBoundary(i, x)}
              />
            )}
            {isLast && (
              <DragHandle
                rootRef={rootRef}
                rect={rect}
                bounds={bounds}
                rows={rows}
                x={car.endMeters}
                y={carY}
                label={`${car.carNumber}号車の末尾（${car.endMeters}m）`}
                selected={false}
                candidates={() => snapCandidates(sortedCars, physicalLength, { exclude: [car.endMeters] })}
                onCommit={(x) => onMoveCarEdge(
                  { carNumber: car.carNumber, side: 'end' },
                  Math.max(x, car.startMeters + MIN_CAR_METERS),
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

type DragHandleProps = {
  rootRef: RefObject<HTMLDivElement | null>;
  rect: { width: number; height: number };
  bounds: Bounds;
  rows: VerticalLayout;
  /** ホーム座標（メートル）。ハンドルの現在位置 */
  x: number;
  /** SVG viewBox 単位（メートル）での縦位置 */
  y: number;
  label: string;
  selected: boolean;
  onFocus?: () => void;
  candidates: () => number[];
  onCommit: (x: number) => void;
};

/**
 * 1つのドラッグ可能なハンドル。x は xFraction 相当の割合(%)、y は実測pxで置く
 * （SVGの要素ボックスがviewBoxより高い場合にy方向だけずれるため。PlatformDiagram
 * の diagramOverlay コメント参照）。role="slider" のボタンとして実装し、
 * キーボード操作（矢印キー）でも同じ座標ロジックを通す。
 */
function DragHandle({
  rootRef, rect, bounds, rows, x, y, label, selected, onFocus, candidates, onCommit,
}: DragHandleProps) {
  const draggingRef = useRef(false);

  const commitClamped = useCallback((raw: number) => {
    const clamped = Math.min(Math.max(raw, bounds.minX), bounds.maxX);
    onCommit(clamped);
  }, [bounds, onCommit]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    onFocus?.();
  }, [onFocus]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    const root = rootRef.current;
    if (!root) return;
    const canvasRect = root.getBoundingClientRect();
    const px = e.clientX - canvasRect.left;
    const raw = pxToMeters(px, bounds, canvasRect.width);
    // Alt/Meta 押下中はグリッド・候補どちらのスナップも無効化し、decimal(6,2)の
    // 丸めのみ適用する（US-2）。Linux の一部WMでAlt+ドラッグが奪われる環境がある
    // ためMetaも受け付ける
    const skipSnap = e.altKey || e.metaKey;
    const snapped = skipSnap
      ? raw
      : snapMeters(raw, candidates(), { gridMeters: SNAP_GRID_METERS, toleranceMeters: SNAP_TOLERANCE_METERS });
    commitClamped(roundToDecimal2(snapped));
  }, [rootRef, bounds, candidates, commitClamped]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    draggingRef.current = false;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    let delta = 0;
    if (e.key === 'ArrowLeft') delta = -1;
    else if (e.key === 'ArrowRight') delta = 1;
    else return;
    e.preventDefault();
    const step = e.shiftKey ? KEYBOARD_FINE_STEP_METERS : SNAP_GRID_METERS;
    onFocus?.();
    commitClamped(roundToDecimal2(x + delta * step));
  }, [x, onFocus, commitClamped]);

  const scale = rect.width > 0 ? rect.width / (bounds.maxX - bounds.minX) : 0;
  const offsetY = rect.height - rows.viewHeight * scale;
  const topPx = offsetY / 2 + y * scale;
  const leftPercent = bounds.maxX > bounds.minX ? ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * 100 : 0;

  return (
    <button
      type="button"
      role="slider"
      aria-label={label}
      aria-valuenow={x}
      aria-valuetext={`${x}m`}
      aria-valuemin={bounds.minX}
      aria-valuemax={bounds.maxX}
      className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 touch-none rounded-full"
      style={{
        left: `${leftPercent}%`,
        top: topPx,
        width: HANDLE_SIZE_PX,
        height: HANDLE_SIZE_PX,
        background: selected ? 'var(--sign-exit-bg)' : 'transparent',
        border: selected ? '2px solid var(--sign-exit-edge)' : '2px dashed transparent',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
    />
  );
}
