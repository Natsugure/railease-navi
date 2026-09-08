import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { LinkAnchor } from '@/components/LinkElements';
import { StationConnectionCreateForm } from '@/features/station-connection/components/StationConnectionCreateForm';
import { stationConnectionCreatePageQuery } from '@/di';

export default async function NewStationConnectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ stationId: string }>;
  searchParams: Promise<{ operatorId?: string; lineId?: string }>;
}) {
  const { stationId } = await params;
  const { operatorId, lineId } = await searchParams;

  const context = await stationConnectionCreatePageQuery.getCreateContext(stationId, {
    operatorId,
    lineId,
  });
  if (!context) notFound();

  return (
    <div>
      <LinkAnchor href={`/stations/${stationId}/edit`} size="sm" mb="lg" style={{ display: 'block' }}>
        &larr; 駅の編集に戻る
      </LinkAnchor>
      <Title order={2} mb="lg">乗換接続を追加 - {context.stationName}</Title>
      <StationConnectionCreateForm
        stationId={stationId}
        operatorId={operatorId ?? ''}
        lineId={lineId ?? ''}
        context={context}
      />
    </div>
  );
}
