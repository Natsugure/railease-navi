import { describe, it, expect } from 'vitest';
import { makeGetStationDetail } from './getStationDetail';
import type { StationDetailQuery } from '../ports';
import type { StationDetailDTO } from '../domain/types';
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

function stationDetail(overrides: Partial<StationDetailDTO> = {}): StationDetailDTO {
  return {
    station: { id: 'st1', name: '渋谷', nameEn: 'Shibuya', code: 'G01', notes: null },
    headerLineColor: '#f39700',
    platforms: [],
    transferConnections: [],
    ...overrides,
  };
}

describe('makeGetStationDetail', () => {
  it('該当する駅が存在しない場合は null を返す', async () => {
    const fake: StationDetailQuery = { getBySlug: async () => null };
    const getStationDetail = makeGetStationDetail({ query: fake });

    const result = await getStationDetail('unknown');

    expect(result).toBeNull();
  });

  it('駅データに方面タブを構築して返す', async () => {
    const p = platform({
      id: 'p1',
      inboundDirectionId: 'dir-in',
      inboundDirectionName: '渋谷方面',
    });
    const fixture = stationDetail({ platforms: [p] });
    const fake: StationDetailQuery = { getBySlug: async () => fixture };
    const getStationDetail = makeGetStationDetail({ query: fake });

    const result = await getStationDetail('shibuya');

    expect(result).not.toBeNull();
    expect(result!.station).toEqual(fixture.station);
    expect(result!.tabs).toEqual([
      { directionId: 'dir-in', directionName: '渋谷方面', platforms: [p] },
    ]);
  });

  it('方面IDを持たないホームは「全方面」タブへ入る', async () => {
    const p = platform({ id: 'p1' });
    const fixture = stationDetail({ platforms: [p] });
    const fake: StationDetailQuery = { getBySlug: async () => fixture };
    const getStationDetail = makeGetStationDetail({ query: fake });

    const result = await getStationDetail('shibuya');

    expect(result!.tabs).toEqual([
      { directionId: null, directionName: '全方面', platforms: [p] },
    ]);
  });

  it('停車位置パターンが0件のホームは列車0本のまま返る', async () => {
    const p = platform({ id: 'p1', stopPatterns: [] });
    const fixture = stationDetail({ platforms: [p] });
    const fake: StationDetailQuery = { getBySlug: async () => fixture };
    const getStationDetail = makeGetStationDetail({ query: fake });

    const result = await getStationDetail('shibuya');

    expect(result!.platforms[0]!.stopPatterns).toEqual([]);
  });
});
