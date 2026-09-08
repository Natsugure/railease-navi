import { NextResponse } from 'next/server';
import { stationConnectionCreateSchema } from '@/features/station-connection/schema';
import { stationConnectionRepository } from '@/di';

// 乗換接続の追加（Issue #88）。駅スコープの POST。
// createPair が有向2行を冪等に挿入するため、同じ組を再送しても 201（行は増えない）。
export async function POST(
  request: Request,
  { params }: { params: Promise<{ stationId: string }> },
) {
  try {
    const { stationId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'リクエストボディが不正な JSON です' }, { status: 400 });
    }

    const parsed = stationConnectionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    if (parsed.data.connectedStationId === stationId) {
      return NextResponse.json({ error: '同じ駅どうしを接続にはできません' }, { status: 400 });
    }

    await stationConnectionRepository.createPair(stationId, parsed.data);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
