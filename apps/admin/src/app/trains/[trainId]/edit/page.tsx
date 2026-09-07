import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { TrainForm } from '@/features/train/components/TrainForm';
import { trainEditPageQuery } from '@/di';

export default async function EditTrainPage({
  params,
}: {
  params: Promise<{ trainId: string }>;
}) {
  const { trainId } = await params;
  const context = await trainEditPageQuery.getEditContext(trainId);

  if (!context?.train) notFound();

  return (
    <div>
      <Title order={2} mb="lg">列車を編集</Title>
      <TrainForm
        isEdit
        initialData={context.train}
        operators={context.operators}
        lines={context.lines}
      />
    </div>
  );
}
