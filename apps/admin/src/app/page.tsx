import { db } from '@furatora/database/client';
import { operators, lines, stations, trains, stationFacilities } from '@furatora/database/schema';
import { count } from 'drizzle-orm';
import { Card, SimpleGrid, Text, Title } from '@mantine/core';

async function fetchCounts() {
  const [operatorCount] = await db.select({ count: count() }).from(operators);
  const [lineCount] = await db.select({ count: count() }).from(lines);
  const [stationCount] = await db.select({ count: count() }).from(stations);
  const [trainCount] = await db.select({ count: count() }).from(trains);
  const [facilityCount] = await db.select({ count: count() }).from(stationFacilities);

  // count() は必ず1行返るが noUncheckedIndexedAccess 下では T | undefined になる。
  // external/query/stationPublishingPageQuery.ts と同じく ?? 0 で受ける
  return {
    operators: operatorCount?.count ?? 0,
    lines: lineCount?.count ?? 0,
    stations: stationCount?.count ?? 0,
    trains: trainCount?.count ?? 0,
    facilities: facilityCount?.count ?? 0,
  };
}

export default async function Dashboard() {
  const counts = await fetchCounts();

  const cards = [
    { label: '事業者', value: counts.operators },
    { label: '路線', value: counts.lines },
    { label: '駅', value: counts.stations },
    { label: '列車', value: counts.trains },
    { label: '設備', value: counts.facilities },
  ];

  return (
    <div>
      <Title order={2} mb="lg">ダッシュボード</Title>
      <SimpleGrid cols={{ base: 2, md: 3, lg: 5 }}>
        {cards.map((card) => (
          <Card key={card.label} shadow="sm" padding="lg" withBorder ta="center">
            <Text size="xl" fw={700}>{card.value}</Text>
            <Text size="sm" c="dimmed" mt="xs">{card.label}</Text>
          </Card>
        ))}
      </SimpleGrid>
    </div>
  );
}
