import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { StationLayoutEditor } from './StationLayoutEditor';
import { toPlatformLocationPayload } from '@/features/station-layout/domain/editDraft';
import type { LayoutPlatformDetailDTO, LayoutConcourseDTO } from '@/features/station-layout/ports';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

// next/link はApp Routerのコンテキストを要求するため、テストでは素の<a>に
// 差し替える。実ナビゲーションはこのモック自身のpreventDefaultで止め、
// コンポーネント側のonClickロジックだけを検証する
vi.mock(
  'next/link',
  () => ({
    default: ({
      href, children, onClick, ...props
    }: { href: string; children?: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) => (
      <a
        href={href}
        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </a>
    ),
  }),
);

const notificationsShow = vi.fn();
vi.mock('@mantine/notifications', () => ({
  notifications: { show: (...args: unknown[]) => notificationsShow(...args) },
}));

// 100m のホーム、2両編成（0-50m/50-100m）、コンコース1件・アクセス点1件（25m）。
// computeBounds は [0,100] + 号車境界{0,50,100} + cell(25) から
// MARGIN_METERS(5) を加えて算出するため、bounds = {minX:-5, maxX:105}(幅110m) になる
const concourse: LayoutConcourseDTO = {
  id: 'concourse-1',
  exits: 'A3出口',
  notes: null,
  cells: [{
    id: 'cell-1',
    xPositionMeters: 25,
    facilities: [{
      id: 'facility-1', typeCode: 'elevator', typeName: 'エレベーター',
      isWheelchairAccessible: true, isStrollerAccessible: true, notes: null,
    }],
  }],
  connections: [],
};

const platform: LayoutPlatformDetailDTO = {
  id: 'platform-1',
  platformNumber: '1',
  lineId: 'line-1',
  lineName: 'テスト線',
  lineColor: null,
  inboundDirectionId: null,
  inboundDirectionName: null,
  outboundDirectionId: null,
  outboundDirectionName: null,
  platformSide: 'bottom',
  notes: null,
  physicalLength: 100,
  concourses: [concourse],
  stopPatterns: [{
    patternId: 'pattern-1',
    trainId: 'train-1',
    trainLabel: 'テスト列車',
    carCount: 2,
    cars: [
      { carNumber: 1, startMeters: 0, endMeters: 50, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
      { carNumber: 2, startMeters: 50, endMeters: 100, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
    ],
  }],
  selectedPatternId: 'pattern-1',
};

const platforms = [{ id: 'platform-1', platformNumber: '1' }, { id: 'platform-2', platformNumber: '2' }];

// scale = rect.width / (maxX - minX) = 550 / 110 = 5（PX_PER_METERと一致させ計算を単純にする）
const RECT = {
  width: 550, height: 200, left: 0, top: 0, right: 550, bottom: 200, x: 0, y: 0, toJSON: () => ({}),
} as DOMRect;

function renderEditor() {
  return render(
    <MantineProvider>
      <StationLayoutEditor stationId="station-1" platforms={platforms} platform={platform} />
    </MantineProvider>,
  );
}

/** アクセス点ハンドルを25m→30mへドラッグしてdirty状態を作る */
function dragCellTo30m() {
  const handle = screen.getByRole('slider', { name: 'アクセス点（25m）' });
  // px = (x - minX) * scale = (25-(-5))*5 = 150 → (30-(-5))*5 = 175
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 150 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 175 });
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: 175 });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
});

describe('StationLayoutEditor', () => {
  it('ドラッグ前は保存パネルが表示されない', () => {
    renderEditor();
    expect(screen.queryByText('未保存の変更')).not.toBeInTheDocument();
  });

  it('ドラッグするとアクセス点が移動し未保存パネルに●バッジが出る', () => {
    renderEditor();
    dragCellTo30m();

    expect(screen.getByRole('slider', { name: 'アクセス点（30m）' })).toBeInTheDocument();
    expect(screen.getByText('未保存の変更')).toBeInTheDocument();
    expect(screen.getByText('●')).toBeInTheDocument();
  });

  it('ドラッグ中は<svg>のviewBoxが変化しない（bounds凍結）', () => {
    renderEditor();
    const svg = document.querySelector('svg')!;
    const viewBoxBefore = svg.getAttribute('viewBox');

    dragCellTo30m();

    expect(svg.getAttribute('viewBox')).toBe(viewBoxBefore);
  });

  it('保存ボタンで期待するURL・method・ボディ全体でfetchが呼ばれる', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    renderEditor();
    dragCellTo30m();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '保存' }));

    const expectedPayload = toPlatformLocationPayload('platform-1', concourse, { cells: [{ id: 'cell-1', xPositionMeters: 30 }] });
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/stations/station-1/platform-locations/concourse-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expectedPayload),
      });
    });
  });

  it('保存成功でrouter.refreshが呼ばれ●バッジが消える', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    renderEditor();
    dragCellTo30m();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
      expect(screen.queryByText('未保存の変更')).not.toBeInTheDocument();
    });
    expect(notificationsShow).toHaveBeenCalledWith(expect.objectContaining({ color: 'green' }));
  });

  it('404レスポンスでエラー通知が出てrouter.refreshは呼ばれない', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
    );
    renderEditor();
    dragCellTo30m();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(notificationsShow).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red', message: 'Not found' }),
      );
    });
    expect(mockRefresh).not.toHaveBeenCalled();
    // 保存失敗時はdraftを破棄しない（●バッジが残る）
    expect(screen.getByText('未保存の変更')).toBeInTheDocument();
  });

  it('未保存のままホームタブを押すと確認モーダルが出て遷移しない', async () => {
    renderEditor();
    dragCellTo30m();

    fireEvent.click(screen.getByRole('link', { name: '2番線' }));

    // Mantine の Modal はポータル + トランジションでマウントされるため findBy で待つ
    // （DeleteButton.test.tsx と同じ前提）
    expect(await screen.findByText('未保存の変更があります')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('確認モーダルで「変更を破棄して移動」を押すとrouter.pushが呼ばれる', async () => {
    renderEditor();
    dragCellTo30m();
    fireEvent.click(screen.getByRole('link', { name: '2番線' }));
    await screen.findByText('未保存の変更があります');

    fireEvent.click(screen.getByRole('button', { name: '変更を破棄して移動' }));

    expect(mockPush).toHaveBeenCalledWith('/stations/station-1/layout?platformId=platform-2');
  });

  it('未保存が無い状態でタブを押しても確認モーダルは出ない', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('link', { name: '2番線' }));
    expect(screen.queryByText('未保存の変更があります')).not.toBeInTheDocument();
  });

  it('未保存のままbeforeunloadすると確認ダイアログを出そうとする', () => {
    renderEditor();
    dragCellTo30m();

    const event = new Event('beforeunload', { cancelable: true });
    const notCancelled = window.dispatchEvent(event);

    expect(notCancelled).toBe(false); // preventDefault()されている
  });

  it('未保存が無ければbeforeunloadはpreventDefaultされない', () => {
    renderEditor();
    const event = new Event('beforeunload', { cancelable: true });
    const notCancelled = window.dispatchEvent(event);
    expect(notCancelled).toBe(true);
  });
});
