import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { PlatformForm } from '@/features/platform/components/PlatformForm';
import { platformEditPageQuery } from '@/di';

export default async function EditPlatformPage({
  params,
}: {
  params: Promise<{ stationId: string; platformId: string }>;
}) {
  const { stationId, platformId } = await params;
  const context = await platformEditPageQuery.getEditContext(stationId, platformId);

  if (!context?.platform) notFound();

  return (
    <div>
      <Title order={2} mb="lg">ホームを編集 - {context.stationName}</Title>
      {/* 同一ルートパターン内で platformId だけが変わる遷移では React が
          コンポーネントを再利用し、前のホームの入力内容が残る。key で作り直す */}
      <PlatformForm
        key={`${stationId}:${platformId}`}
        stationId={stationId}
        isEdit
        initialData={context.platform}
        lines={context.lines}
      />
    </div>
  );
}
