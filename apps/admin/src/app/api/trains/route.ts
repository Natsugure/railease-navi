import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { trains, trainEquipments, trainCarStructures } from '@furatora/database/schema';
import { asc } from 'drizzle-orm';
import { trainSchema } from '@/features/train/schema';
import { requireInserted } from '@/external/requireInserted';

export async function GET() {
  try {
    const result = await db.select().from(trains).orderBy(asc(trains.name));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = trainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { name, operatorId, lineIds, carCount, carStructure, freeSpaces, prioritySeats } = parsed.data;

    const created = requireInserted(
      await db
        .insert(trains)
        .values({
          name,
          operators: operatorId,
          lines: lineIds,
          carCount,
        })
        .returning()
    );

    if (carStructure && carStructure.length > 0) {
      await db.insert(trainCarStructures).values(
        carStructure.map((cs) => ({
          trainId: created.id,
          carNumber: cs.carNumber,
          doorCount: cs.doorCount,
          carLength: cs.carLength != null ? String(cs.carLength) : null,
        }))
      );
    }

    const equipmentRows = [
      ...(freeSpaces ?? []).map((fs) => ({
        trainId: created.id,
        type: 'free_space' as const,
        carNumber: fs.carNumber,
        nearDoor: fs.nearDoor,
        isStandard: fs.isStandard,
      })),
      ...(prioritySeats ?? []).map((ps) => ({
        trainId: created.id,
        type: 'priority_seat' as const,
        carNumber: ps.carNumber,
        nearDoor: ps.nearDoor,
        isStandard: ps.isStandard,
      })),
    ];

    if (equipmentRows.length > 0) {
      await db.insert(trainEquipments).values(equipmentRows);
    }

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
