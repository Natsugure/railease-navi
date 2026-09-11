import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { StationLayoutView } from './StationLayoutView';
import type { LayoutPlatformDetailDTO, LayoutConcourseDTO, StationLayoutContext } from '@/features/station-layout/ports';

// StationLayoutView は StationLayoutEditor（Client Component、Issue #95 PR3）を
// 常に描画するようになった。useRouter() が App Router のコンテキストを要求するためモックする
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// 座標を持たないコンコース。図には描けず「位置未登録の設備・乗換」に出る
const undrawableConcourse: LayoutConcourseDTO = {
  id: 'concourse-1',
  exits: '3番出口',
  notes: null,
  cells: [
    {
      id: 'cell-1',
      xPositionMeters: null,
      facilities: [
        {
          id: 'f-1', typeCode: 'elevator', typeName: 'エレベーター',
          isWheelchairAccessible: true, isStrollerAccessible: true, notes: null,
        },
      ],
    },
  ],
  connections: [],
};

function buildPlatform(overrides: Partial<LayoutPlatformDetailDTO>): LayoutPlatformDetailDTO {
  return {
    id: 'platform-1',
    platformNumber: '1',
    lineId: 'line-1',
    lineName: '銀座線',
    lineColor: '#ff9500',
    inboundDirectionId: null,
    inboundDirectionName: null,
    outboundDirectionId: null,
    outboundDirectionName: null,
    platformSide: null,
    notes: '階段は1か所のみ',
    physicalLength: 200,
    stopPatterns: [],
    concourses: [undrawableConcourse],
    selectedPatternId: null,
    ...overrides,
  };
}

function renderView(platform: LayoutPlatformDetailDTO) {
  const context: StationLayoutContext = {
    stationName: '渋谷',
    platforms: [{ id: platform.id, platformNumber: platform.platformNumber }],
    platform,
  };
  return render(
    <MantineProvider>
      <StationLayoutView stationId="station-1" context={context} />
    </MantineProvider>,
  );
}

describe('StationLayoutView', () => {
  // 図を描けない状態でも、座標未入力のデータと備考は見えていなければならない（web の PlatformDisplay と同じ）
  it('ホーム長が未入力でも、位置未登録の設備と備考を表示する', () => {
    renderView(buildPlatform({ physicalLength: 0 }));

    expect(screen.getByText('ホーム長が未登録のため図を表示できません')).toBeInTheDocument();
    expect(screen.getByText('位置未登録の設備・乗換')).toBeInTheDocument();
    expect(screen.getByText('3番出口')).toBeInTheDocument();
    expect(screen.getByText('エレベーター')).toBeInTheDocument();
    expect(screen.getByText('階段は1か所のみ')).toBeInTheDocument();
  });

  it('停車パターンが無くても、位置未登録の設備と備考を表示する', () => {
    renderView(buildPlatform({ physicalLength: 200, stopPatterns: [], selectedPatternId: null }));

    expect(screen.getByText('列車情報がありません')).toBeInTheDocument();
    expect(screen.getByText('位置未登録の設備・乗換')).toBeInTheDocument();
    expect(screen.getByText('3番出口')).toBeInTheDocument();
    expect(screen.getByText('階段は1か所のみ')).toBeInTheDocument();
  });
});
