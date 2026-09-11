import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { layoutRows, type Bounds } from '@furatora/platform-diagram/domain';
import { DiagramEditLayer } from './DiagramEditLayer';

// 100m のホーム。50mずつの2両編成、ドア4枚（等分なのでドア中心は
// 車1: 6.25/18.75/31.25/43.75、車2: 56.25/68.75/81.25/93.75）
const bounds: Bounds = { minX: 0, maxX: 100 };
const physicalLength = 100;
const rows = layoutRows('bottom', { hasConcourseLeaders: false });
const cars = [
  { carNumber: 1, startMeters: 0, endMeters: 50, doorCount: 4 },
  { carNumber: 2, startMeters: 50, endMeters: 100, doorCount: 4 },
];

// キャンバス実測幅500px（= 100m × 5px/m PX_PER_METER）。高さはviewHeightに
// 一致させ、offsetYが0になるようにする（アスペクト比が一致した状態を再現）
const RECT = {
  width: 500, height: rows.viewHeight * 5, left: 0, top: 0, right: 500,
  bottom: rows.viewHeight * 5, x: 0, y: 0, toJSON: () => ({}),
} as DOMRect;

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
});

function renderLayer(overrides: Partial<React.ComponentProps<typeof DiagramEditLayer>> = {}) {
  const onSelectCell = vi.fn();
  const onMoveCell = vi.fn();
  const onMoveCarBoundary = vi.fn();
  const onMoveCarEdge = vi.fn();

  render(
    <DiagramEditLayer
      rows={rows}
      bounds={bounds}
      physicalLength={physicalLength}
      cars={cars}
      cellHandles={[{ id: 'cell-1', xPositionMeters: 25 }]}
      selectedCellId={null}
      onSelectCell={onSelectCell}
      onMoveCell={onMoveCell}
      onMoveCarBoundary={onMoveCarBoundary}
      onMoveCarEdge={onMoveCarEdge}
      {...overrides}
    />,
  );

  return { onSelectCell, onMoveCell, onMoveCarBoundary, onMoveCarEdge };
}

function drag(handle: HTMLElement, fromClientX: number, toClientX: number, extra: Partial<PointerEvent> = {}) {
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: fromClientX });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: toClientX, ...extra });
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: toClientX });
}

describe('アクセス点のドラッグ', () => {
  it('ドラッグするとpxToMeters→snapMetersを経た値でonMoveCellが呼ばれる', () => {
    const { onMoveCell } = renderLayer();
    const handle = screen.getByRole('slider', { name: 'アクセス点（25m）' });

    // clientX=200px → 40m。どの候補からも0.4m以上離れているためグリッド丸め
    // のみが効き、40は既に0.5mグリッドなのでそのまま
    drag(handle, 125, 200);

    expect(onMoveCell).toHaveBeenCalledWith('cell-1', 40);
  });

  it('pointerdownで選択される', () => {
    const { onSelectCell } = renderLayer();
    const handle = screen.getByRole('slider', { name: 'アクセス点（25m）' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 125 });
    expect(onSelectCell).toHaveBeenCalledWith('cell-1');
  });

  it('Alt押下中はグリッド・候補どちらのスナップも無効化し decimal(6,2) の丸めのみ適用する', () => {
    const { onMoveCell } = renderLayer();
    const handle = screen.getByRole('slider', { name: 'アクセス点（25m）' });

    // clientX=213px → 42.6m。スナップが効けば0.5グリッドの42.5になるはずだが、
    // Altでスナップ無効化されるため42.6のまま
    drag(handle, 125, 213, { altKey: true });

    expect(onMoveCell).toHaveBeenCalledWith('cell-1', 42.6);
  });

  it('Meta押下中もスナップが無効化される', () => {
    const { onMoveCell } = renderLayer();
    const handle = screen.getByRole('slider', { name: 'アクセス点（25m）' });
    drag(handle, 125, 213, { metaKey: true });
    expect(onMoveCell).toHaveBeenCalledWith('cell-1', 42.6);
  });

  it('凍結boundsの外へドラッグしようとするとクランプされる', () => {
    const { onMoveCell } = renderLayer();
    const handle = screen.getByRole('slider', { name: 'アクセス点（25m）' });
    // clientX=600px → 120m。bounds.maxXは100
    drag(handle, 125, 600);
    expect(onMoveCell).toHaveBeenCalledWith('cell-1', 100);
  });

  it('号車境界に近づけるとスナップして吸着する', () => {
    const { onMoveCell } = renderLayer();
    const handle = screen.getByRole('slider', { name: 'アクセス点（25m）' });
    // clientX=251px → 50.2m。号車境界50mまでの距離0.2mは許容範囲(0.4m)内なので吸着する
    drag(handle, 125, 251);
    expect(onMoveCell).toHaveBeenCalledWith('cell-1', 50);
  });

  it('ArrowRightキーでグリッド幅ぶん進む', () => {
    const { onMoveCell } = renderLayer();
    const handle = screen.getByRole('slider', { name: 'アクセス点（25m）' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onMoveCell).toHaveBeenCalledWith('cell-1', 25.5);
  });

  it('ArrowLeftキーでグリッド幅ぶん戻る', () => {
    const { onMoveCell } = renderLayer();
    const handle = screen.getByRole('slider', { name: 'アクセス点（25m）' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onMoveCell).toHaveBeenCalledWith('cell-1', 24.5);
  });

  it('Shift+ArrowRightキーで微調整（0.1m）ぶん進む', () => {
    const { onMoveCell } = renderLayer();
    const handle = screen.getByRole('slider', { name: 'アクセス点（25m）' });
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
    expect(onMoveCell).toHaveBeenCalledWith('cell-1', 25.1);
  });
});

describe('号車境界・外端のドラッグ', () => {
  it('内側の境界をドラッグするとboundaryIndexつきでonMoveCarBoundaryが呼ばれる', () => {
    const { onMoveCarBoundary } = renderLayer();
    const handle = screen.getByRole('slider', { name: '1号車と2号車の境界（50m）' });
    // clientX=350px → 70m。候補から離れているためグリッド丸め(70のまま)
    drag(handle, 250, 350);
    expect(onMoveCarBoundary).toHaveBeenCalledWith(0, 70);
  });

  it('1号車の先頭（編成の左端）をドラッグするとonMoveCarEdgeが呼ばれる', () => {
    const { onMoveCarEdge } = renderLayer();
    const handle = screen.getByRole('slider', { name: '1号車の先頭（0m）' });
    drag(handle, 0, 50); // 50px→10m
    expect(onMoveCarEdge).toHaveBeenCalledWith({ carNumber: 1, side: 'start' }, 10);
  });

  it('最終号車の末尾（編成の右端）をドラッグするとonMoveCarEdgeが呼ばれる', () => {
    const { onMoveCarEdge } = renderLayer();
    const handle = screen.getByRole('slider', { name: '2号車の末尾（100m）' });
    drag(handle, 500, 450); // 450px→90m
    expect(onMoveCarEdge).toHaveBeenCalledWith({ carNumber: 2, side: 'end' }, 90);
  });
});
