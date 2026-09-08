import { NextResponse } from 'next/server';
import { stationConnectionRepository } from '@/di';

// 乗換接続の削除（Issue #88）。有向2行（A→B と B→A）の両方を削除する。
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stationId: string; connectedStationId: string }> },
) {
  try {
    const { stationId, connectedStationId } = await params;

    const deleted = await stationConnectionRepository.deletePair(stationId, connectedStationId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
