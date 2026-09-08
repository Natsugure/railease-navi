import { Title } from '@mantine/core';
import { LineForm } from '@/components/LineForm';
import { lineEditPageQuery } from '@/di';

export default async function NewLinePage() {
  const context = await lineEditPageQuery.getCreateContext();

  return (
    <div>
      <Title order={2} mb="lg">新規路線</Title>
      <LineForm operators={context.operators} />
    </div>
  );
}
