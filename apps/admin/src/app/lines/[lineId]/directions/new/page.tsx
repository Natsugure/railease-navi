import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { LineDirectionForm } from '@/components/LineDirectionForm';
import { lineDirectionEditPageQuery } from '@/di';

export default async function NewDirectionPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const { lineId } = await params;
  const context = await lineDirectionEditPageQuery.getCreateContext(lineId);

  if (!context) notFound();

  return (
    <div>
      <Title order={2} mb="lg">新規方面 - {context.lineName}</Title>
      <LineDirectionForm lineId={lineId} stations={context.stations} />
    </div>
  );
}
