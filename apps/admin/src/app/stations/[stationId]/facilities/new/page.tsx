import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { FacilityForm } from '@/features/facility/components/FacilityForm';
import { facilityEditPageQuery } from '@/di';

export default async function NewFacilityPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  const context = await facilityEditPageQuery.getCreateContext(stationId);

  if (!context) notFound();

  return (
    <div>
      <Title order={2} mb="lg">新規設備場所 - {context.stationName}</Title>
      {/* 同一ルートパターン内で stationId だけが変わる遷移では React が
          コンポーネントを再利用し、前の駅の入力内容が残る。key で作り直す */}
      <FacilityForm
        key={stationId}
        stationId={stationId}
        platforms={context.platforms}
        facilityTypes={context.facilityTypes}
        connectedStations={context.connectedStations}
      />
    </div>
  );
}
