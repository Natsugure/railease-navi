// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const createPair = vi.fn();

vi.mock('@/di', () => ({
  stationConnectionRepository: {
    createPair: (...args: unknown[]) => createPair(...args),
  },
}));

const STATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_ID = '550e8400-e29b-41d4-a716-446655440099';
const mockParams = Promise.resolve({ stationId: STATION_ID });

function request(body: unknown) {
  return new Request(`http://localhost/api/stations/${STATION_ID}/connections`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/stations/[stationId]/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常なリクエストで201を返し createPair を呼ぶ', async () => {
    createPair.mockResolvedValue(undefined);

    const response = await POST(request({ connectedStationId: OTHER_ID }), { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual({ success: true });
    expect(createPair).toHaveBeenCalledWith(
      STATION_ID,
      expect.objectContaining({ connectedStationId: OTHER_ID }),
    );
  });

  it('自己接続（connectedStationId が自駅）の場合は400を返す', async () => {
    const response = await POST(request({ connectedStationId: STATION_ID }), { params: mockParams });

    expect(response.status).toBe(400);
    expect(createPair).not.toHaveBeenCalled();
  });

  it('connectedStationId が UUID でない場合は400を返す', async () => {
    const response = await POST(request({ connectedStationId: 'x' }), { params: mockParams });

    expect(response.status).toBe(400);
    expect(createPair).not.toHaveBeenCalled();
  });

  it('Repository が例外を投げた場合は500を返す', async () => {
    createPair.mockRejectedValue(new Error('DB error'));

    const response = await POST(request({ connectedStationId: OTHER_ID }), { params: mockParams });

    expect(response.status).toBe(500);
  });
});
