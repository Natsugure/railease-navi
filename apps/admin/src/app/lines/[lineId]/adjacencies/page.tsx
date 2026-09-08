import { notFound } from 'next/navigation';
import { Card, Group, Stack, Text, Title } from '@mantine/core';
import { DeleteButton } from '@/components/DeleteButton';
import { LinkAnchor } from '@/components/LinkElements';
import { StationAdjacencyCreateForm } from '@/features/station-adjacency/components/StationAdjacencyCreateForm';
import { stationAdjacencyPageQuery } from '@/di';

export default async function LineAdjacenciesPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const { lineId } = await params;
  const context = await stationAdjacencyPageQuery.getPageContext(lineId);
  if (!context) notFound();

  return (
    <div>
      <LinkAnchor href="/lines" size="sm" mb="lg" style={{ display: 'block' }}>
        &larr; 路線一覧に戻る
      </LinkAnchor>

      <Title order={2} mb={4}>{context.lineName}</Title>
      <Text size="sm" c="dimmed" mb="lg">路線内の隣接を管理</Text>

      <Text size="sm" c="dimmed" mb="md">
        隣接は無向の辺として1行で保持されます（逆向きで追加しても重複しません）。
      </Text>

      <Card withBorder padding="md" mb="lg">
        <StationAdjacencyCreateForm lineId={lineId} stations={context.stations} />
      </Card>

      {context.adjacencies.length === 0 ? (
        <Text size="sm" c="dimmed">隣接がまだ登録されていません。</Text>
      ) : (
        <Stack gap="xs">
          {context.adjacencies.map((adj) => (
            <Card key={adj.id} withBorder padding="sm">
              <Group justify="space-between">
                <Text>{adj.stationAName} — {adj.stationBName}</Text>
                <DeleteButton endpoint={`/api/lines/${lineId}/adjacencies/${adj.id}`} />
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </div>
  );
}
