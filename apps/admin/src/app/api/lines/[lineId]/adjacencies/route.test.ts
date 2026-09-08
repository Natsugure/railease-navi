// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const create = vi.fn();

vi.mock('@/di', () => ({
  stationAdjacencyRepository: {
    create: (...args: unknown[]) => create(...args),
  },
}));

const LINE_ID = '550e8400-e29b-41d4-a716-446655440000';
const A = '550e8400-e29b-41d4-a716-446655440001';
const B = '550e8400-e29b-41d4-a716-446655440002';
const mockParams = Promise.resolve({ lineId: LINE_ID });

function request(body: unknown) {
  return new Request(`http://localhost/api/lines/${LINE_ID}/adjacencies`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/lines/[lineId]/adjacencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常なリクエストで201を返し create を呼ぶ', async () => {
    create.mockResolvedValue(undefined);

    const response = await POST(request({ stationAId: A, stationBId: B }), { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual({ success: true });
    expect(create).toHaveBeenCalledWith(LINE_ID, A, B);
  });

  it('同じ駅どうし（自己隣接）の場合は400を返す', async () => {
    const response = await POST(request({ stationAId: A, stationBId: A }), { params: mockParams });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('端点が路線に属さない場合は422を返す', async () => {
    const { AdjacencyEndpointNotOnLineError } = await import('@/features/station-adjacency/ports');
    create.mockRejectedValue(new AdjacencyEndpointNotOnLineError());

    const response = await POST(request({ stationAId: A, stationBId: B }), { params: mockParams });
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data).toHaveProperty('error');
  });

  it('未知の例外の場合は500を返す', async () => {
    create.mockRejectedValue(new Error('DB error'));

    const response = await POST(request({ stationAId: A, stationBId: B }), { params: mockParams });

    expect(response.status).toBe(500);
  });
});
