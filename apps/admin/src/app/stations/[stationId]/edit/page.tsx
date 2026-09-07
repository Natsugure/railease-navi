import { notFound } from 'next/navigation';
import { Title, Text } from '@mantine/core';
import { StationEditForm } from '@/components/StationEditForm';
import { stationEditPageQuery } from '@/di';

type Props = {
  params: Promise<{ stationId: string }>;
};

export default async function StationEditPage({ params }: Props) {
  const { stationId } = await params;
  const context = await stationEditPageQuery.getEditContext(stationId);
  if (!context) {
    notFound();
  }

  return (
    <div>
      <Title order={2} mb="xs">{context.station.name} — 編集</Title>
      {context.station.nameEn && (
        <Text size="sm" c="dimmed" mb="lg">{context.station.nameEn}</Text>
      )}

      <StationEditForm
        stationId={stationId}
        initialData={context.station}
        connections={context.connections}
        operators={context.operators}
      />
    </div>
  );
}
