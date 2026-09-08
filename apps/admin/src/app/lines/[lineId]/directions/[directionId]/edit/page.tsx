import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { LineDirectionForm } from '@/components/LineDirectionForm';
import { lineDirectionEditPageQuery } from '@/di';

export default async function EditDirectionPage({
  params,
}: {
  params: Promise<{ lineId: string; directionId: string }>;
}) {
  const { lineId, directionId } = await params;
  const context = await lineDirectionEditPageQuery.getEditContext(lineId, directionId);

  if (!context?.direction) notFound();

  return (
    <div>
      <Title order={2} mb="lg">方面を編集 - {context.lineName}</Title>
      <LineDirectionForm
        lineId={lineId}
        isEdit
        initialData={context.direction}
        stations={context.stations}
      />
    </div>
  );
}
