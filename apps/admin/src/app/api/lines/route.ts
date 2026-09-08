import { NextResponse } from 'next/server';
import { lineCreateSchema } from '@/features/line/schema';
import { lineRepository } from '@/di';

// 路線の新規作成（Issue #88）。既存の `PUT /api/lines/[lineId]` に相乗りさせず、
// コレクションに対する POST として分ける。書き込みは `@/di` 経由の Repository で行い、
// この層は `@furatora/database` を import しない（ADR-0001。新規ファイルのため
// `apps/admin/eslint.config.mjs` の legacyExclusions には載せない）。
export async function POST(request: Request) {
  try {
    // 空ボディ・不正 JSON は 400。request.json() の例外を下の catch に落とすと 500 になる
    // （publication/route.ts と同じガード）。
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'リクエストボディが不正な JSON です' }, { status: 400 });
    }

    const parsed = lineCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const line = await lineRepository.create(parsed.data);

    return NextResponse.json(line, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
