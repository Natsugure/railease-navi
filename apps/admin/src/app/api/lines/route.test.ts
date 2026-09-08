// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const create = vi.fn();

vi.mock('@/di', () => ({
  lineRepository: {
    create: (...args: unknown[]) => create(...args),
  },
}));

const OPERATOR_ID = '550e8400-e29b-41d4-a716-446655440000';

function request(body: unknown) {
  return new Request('http://localhost/api/lines', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function rawRequest(rawBody: string) {
  return new Request('http://localhost/api/lines', {
    method: 'POST',
    body: rawBody,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/lines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常なリクエストで201と作成行を返す', async () => {
    const created = { id: 'line-1', name: '銀座線', operatorId: OPERATOR_ID };
    create.mockResolvedValue(created);

    const response = await POST(request({ name: '銀座線', operatorId: OPERATOR_ID }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(created);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: '銀座線', operatorId: OPERATOR_ID }),
    );
  });

  it('name が空の場合は400を返す', async () => {
    const response = await POST(request({ name: '', operatorId: OPERATOR_ID }));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('operatorId が欠けている場合は400を返す', async () => {
    const response = await POST(request({ name: '銀座線' }));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('ボディが不正な JSON の場合は500ではなく400を返す', async () => {
    const response = await POST(rawRequest('{ not json'));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('Repository が例外を投げた場合は500を返す', async () => {
    create.mockRejectedValue(new Error('DB error'));

    const response = await POST(request({ name: '銀座線', operatorId: OPERATOR_ID }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });
});
