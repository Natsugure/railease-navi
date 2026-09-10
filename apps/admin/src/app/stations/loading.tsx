import { Group, Skeleton, Stack, Title } from '@mantine/core';

export default function Loading() {
  return (
    <div>
      <Title order={2} mb="lg">駅</Title>
      <Group mb="md" align="flex-end">
        <Skeleton height={62} width={220} />
        <Skeleton height={62} width={220} />
        <Skeleton height={62} width={260} />
      </Group>
      <Stack gap={2}>
        <Skeleton height={44} radius={0} />
        {Array.from({ length: 15 }).map((_, i) => (
          <Skeleton key={i} height={48} radius={0} />
        ))}
      </Stack>
    </div>
  );
}
