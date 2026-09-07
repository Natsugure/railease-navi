import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { lineDirections } from '@furatora/database/schema';
import { directionSchema } from '@/lib/validations';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lineId: string }> }
) {
  try {
    const { lineId } = await params;
    const body = await request.json();
    const parsed = directionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { directionType, representativeStationId, displayName, displayNameEn, terminalStationIds, notes } = parsed.data;

    const [direction] = await db
      .insert(lineDirections)
      .values({
        lineId,
        directionType,
        representativeStationId,
        displayName,
        displayNameEn: displayNameEn ?? null,
        terminalStationIds: terminalStationIds ?? null,
        notes: notes ?? null,
      })
      .returning();

    return NextResponse.json(direction, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
