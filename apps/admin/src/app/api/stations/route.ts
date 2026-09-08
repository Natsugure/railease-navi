import { NextResponse } from 'next/server';
import { stationCreateSchema } from '@/features/station/schema';
import { StationReferenceNotFoundError } from '@/features/station/ports';
import { stationRepository } from '@/di';

// 駅の新規作成（Issue #88）。既存の `PUT /api/stations/[stationId]` に相乗りさせず、
// コレクションに対する POST として分ける。書き込みは `@/di` 経由の Repository
// （stations + stationLines を1トランザクション）で行い、この層は
// `@furatora/database` を import しない（ADR-0001。新規ファイルのため legacyExclusions
// には載せない）。
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'リクエストボディが不正な JSON です' }, { status: 400 });
    }

    const parsed = stationCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const station = await stationRepository.create(parsed.data);

    return NextResponse.json(station, { status: 201 });
  } catch (err) {
    // 存在しない事業者・路線・駅グループを指定した（FK 違反）。
    // 入力形式は正しいがリソースが無いので 422。
    if (err instanceof StationReferenceNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
