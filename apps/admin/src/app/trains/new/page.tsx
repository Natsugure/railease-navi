import { Title } from '@mantine/core';
import { TrainForm } from '@/features/train/components/TrainForm';
import { trainEditPageQuery } from '@/di';

export default async function NewTrainPage() {
  const context = await trainEditPageQuery.getCreateContext();

  return (
    <div>
      <Title order={2} mb="lg">新規列車</Title>
      <TrainForm operators={context.operators} lines={context.lines} />
    </div>
  );
}
