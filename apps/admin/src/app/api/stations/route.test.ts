// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const create = vi.fn();

vi.mock('@/di', () => ({
  stationRepository: {
    create: (...args: unknown[]) => create(...args),
  },
}));

const OPERATOR_ID = '550e8400-e29b-41d4-a716-446655440000';
const LINE_ID = '550e8400-e29b-41d4-a716-446655440001';

function request(body: unknown) {
  return new Request('http://localhost/api/stations', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function rawRequest(rawBody: string) {
  return new Request('http://localhost/api/stations', {
    method: 'POST',
    body: rawBody,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/stations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常なリクエストで201と作成行を返す', async () => {
    const created = { id: 'station-1', name: '銀座' };
    create.mockResolvedValue(created);

    const response = await POST(request({ name: '銀座', operatorId: OPERATOR_ID, lineId: LINE_ID }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(created);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: '銀座', operatorId: OPERATOR_ID, lineId: LINE_ID }),
    );
  });

  it('lineId が欠けている場合は400を返す', async () => {
    const response = await POST(request({ name: '銀座', operatorId: OPERATOR_ID }));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('存在しない参照先（FK 違反）の場合は422を返す', async () => {
    const { StationReferenceNotFoundError } = await import('@/features/station/ports');
    create.mockRejectedValue(new StationReferenceNotFoundError());

    const response = await POST(request({ name: '銀座', operatorId: OPERATOR_ID, lineId: LINE_ID }));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data).toHaveProperty('error');
  });

  it('ボディが不正な JSON の場合は500ではなく400を返す', async () => {
    const response = await POST(rawRequest('{ not json'));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('未知の例外の場合は500を返す', async () => {
    create.mockRejectedValue(new Error('DB error'));

    const response = await POST(request({ name: '銀座', operatorId: OPERATOR_ID, lineId: LINE_ID }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });
});
