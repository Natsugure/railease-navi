import { NextResponse } from 'next/server';
import { stationAdjacencyCreateSchema } from '@/features/station-adjacency/schema';
import { AdjacencyEndpointNotOnLineError } from '@/features/station-adjacency/ports';
import { stationAdjacencyRepository } from '@/di';

// 路線内の隣接の追加（Issue #88）。端点の昇順正規化と lineId 所属の検証は
// Repository が担う。冪等なので同じ辺を再送しても 201。
export async function POST(
  request: Request,
  { params }: { params: Promise<{ lineId: string }> },
) {
  try {
    const { lineId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'リクエストボディが不正な JSON です' }, { status: 400 });
    }

    const parsed = stationAdjacencyCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    await stationAdjacencyRepository.create(lineId, parsed.data.stationAId, parsed.data.stationBId);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof AdjacencyEndpointNotOnLineError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
