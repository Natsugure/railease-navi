import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { POST } from './route';

vi.mock('@furatora/database/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@furatora/database/schema', () => ({
  operators: {},
}));

const mockOperator = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'JR東日本',
  odptOperatorId: null,
  displayPriority: 0,
};

describe('POST /api/operators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常なリクエストで201とオペレーターを返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockReturning = vi.fn().mockResolvedValue([mockOperator]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    (db.insert as Mock).mockReturnValue({ values: mockValues });

    const request = new Request('http://localhost/api/operators', {
      method: 'POST',
      body: JSON.stringify({ name: 'JR東日本' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(mockOperator);
  });

  it('バリデーションエラーの場合は400を返す', async () => {
    const request = new Request('http://localhost/api/operators', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('displayPriorityにnullを渡すと400を返す（NOT NULL 化後）', async () => {
    const request = new Request('http://localhost/api/operators', {
      method: 'POST',
      body: JSON.stringify({ name: 'JR東日本', displayPriority: null }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('DB例外が発生した場合は500を返す', async () => {
    const { db } = await import('@furatora/database/client');
    const mockReturning = vi.fn().mockRejectedValue(new Error('DB error'));
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    (db.insert as Mock).mockReturnValue({ values: mockValues });

    const request = new Request('http://localhost/api/operators', {
      method: 'POST',
      body: JSON.stringify({ name: 'JR東日本' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });
});
