import { Title } from '@mantine/core';
import { StationCreateForm } from '@/components/StationCreateForm';
import { stationCreatePageQuery } from '@/di';

export default async function NewStationPage({
  searchParams,
}: {
  searchParams: Promise<{ prefCode?: string }>;
}) {
  const { prefCode: prefCodeParam } = await searchParams;
  const parsed = prefCodeParam === undefined ? NaN : Number(prefCodeParam);
  const prefCode = Number.isInteger(parsed) ? parsed : null;

  const context = await stationCreatePageQuery.getCreateContext(prefCode ?? undefined);

  return (
    <div>
      <Title order={2} mb="lg">新規駅</Title>
      <StationCreateForm
        operators={context.operators}
        lines={context.lines}
        stationGroups={context.stationGroups}
        prefCode={prefCode}
      />
    </div>
  );
}
