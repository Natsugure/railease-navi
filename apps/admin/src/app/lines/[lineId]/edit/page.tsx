import { notFound } from 'next/navigation';
import { Title, Text } from '@mantine/core';
import { LineForm } from '@/components/LineForm';
import { lineEditPageQuery } from '@/di';

export default async function LineEditPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const { lineId } = await params;
  const context = await lineEditPageQuery.getEditContext(lineId);

  if (!context) {
    notFound();
  }

  return (
    <div>
      <Title order={2} mb="xs">路線を編集</Title>
      <Text size="sm" c="dimmed" mb="lg">{context.line.name}</Text>
      <LineForm lineId={lineId} initialData={context.line} operators={context.operators} />
    </div>
  );
}
