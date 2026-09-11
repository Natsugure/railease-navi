import { describe, it, expect } from 'vitest';
import { buildDirectionTabs } from './tabs';
import type { PlatformDTO } from '@furatora/platform-diagram/domain';

function platform(overrides: Partial<PlatformDTO> & { id: string }): PlatformDTO {
  return {
    platformNumber: '1',
    lineId: 'line-1',
    lineName: '銀座線',
    lineColor: '#f39700',
    inboundDirectionId: null,
    inboundDirectionName: null,
    outboundDirectionId: null,
    outboundDirectionName: null,
    platformSide: null,
    notes: null,
    physicalLength: 100,
    stopPatterns: [],
    concourses: [],
    ...overrides,
  };
}

describe('buildDirectionTabs', () => {
  it('ホームが0件なら空配列を返す', () => {
    expect(buildDirectionTabs([])).toEqual([]);
  });

  it('方面IDを持たないホームだけの場合は「全方面」タブ1つにまとまる', () => {
    const platforms = [platform({ id: 'p1' }), platform({ id: 'p2' })];
    const tabs = buildDirectionTabs(platforms);
    expect(tabs).toEqual([
      { directionId: null, directionName: '全方面', platforms },
    ]);
  });

  it('inbound/outbound の両方面に登録されたホームは両方のタブに現れる', () => {
    const p = platform({
      id: 'p1',
      inboundDirectionId: 'dir-in',
      inboundDirectionName: '渋谷方面',
      outboundDirectionId: 'dir-out',
      outboundDirectionName: '浅草方面',
    });
    const tabs = buildDirectionTabs([p]);
    expect(tabs).toEqual([
      { directionId: 'dir-in', directionName: '渋谷方面', platforms: [p] },
      { directionId: 'dir-out', directionName: '浅草方面', platforms: [p] },
    ]);
  });

  it('同一方面タブに同一ホームを重複登録しない', () => {
    // 2つのホームが同じ inbound 方面を共有するケース
    const p1 = platform({ id: 'p1', inboundDirectionId: 'dir-in', inboundDirectionName: '渋谷方面' });
    const p2 = platform({ id: 'p2', inboundDirectionId: 'dir-in', inboundDirectionName: '渋谷方面' });
    const tabs = buildDirectionTabs([p1, p2]);
    expect(tabs).toEqual([
      { directionId: 'dir-in', directionName: '渋谷方面', platforms: [p1, p2] },
    ]);
  });

  it('方面ID有りと無しのホームが混在する場合、無しは「全方面」タブへ入る', () => {
    const withDir = platform({ id: 'p1', inboundDirectionId: 'dir-in', inboundDirectionName: '渋谷方面' });
    const withoutDir = platform({ id: 'p2' });
    const tabs = buildDirectionTabs([withDir, withoutDir]);
    expect(tabs).toEqual([
      { directionId: 'dir-in', directionName: '渋谷方面', platforms: [withDir] },
      { directionId: null, directionName: '全方面', platforms: [withoutDir] },
    ]);
  });

  it('directionName が null の場合は "方面" にフォールバックする', () => {
    const p = platform({ id: 'p1', inboundDirectionId: 'dir-in', inboundDirectionName: null });
    const tabs = buildDirectionTabs([p]);
    expect(tabs[0]!.directionName).toBe('方面');
  });
});
