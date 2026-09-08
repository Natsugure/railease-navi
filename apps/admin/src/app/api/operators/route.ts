import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { operators } from '@furatora/database/schema';
import { operatorSchema } from '@/lib/validations';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = operatorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { name, odptOperatorId, displayPriority } = parsed.data;
    const [operator] = await db
      .insert(operators)
      .values({
        name,
        odptOperatorId: odptOperatorId ?? null,
        displayPriority: displayPriority ?? 0,
      })
      .returning();
    return NextResponse.json(operator, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
