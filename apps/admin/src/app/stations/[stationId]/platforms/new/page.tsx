import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { PlatformForm } from '@/features/platform/components/PlatformForm';
import { platformEditPageQuery } from '@/di';

export default async function NewPlatformPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  const context = await platformEditPageQuery.getCreateContext(stationId);

  if (!context) notFound();

  return (
    <div>
      <Title order={2} mb="lg">新規ホーム - {context.stationName}</Title>
      {/* 同一ルートパターン内で stationId だけが変わる遷移では React が
          コンポーネントを再利用し、前の駅の入力内容が残る。key で作り直す */}
      <PlatformForm key={stationId} stationId={stationId} lines={context.lines} />
    </div>
  );
}
