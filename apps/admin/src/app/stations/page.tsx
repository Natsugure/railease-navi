import { db } from '@furatora/database/client';
import {
  operators,
  lines,
  stationLines,
  stations,
} from '@furatora/database/schema';
import { asc, eq } from 'drizzle-orm';
import { LinkAnchor, LinkButton } from '@/components/LinkElements';
import { Badge, Group, ScrollArea, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';

export default async function StationsPage() {
  const operatorList = await db.select().from(operators).orderBy(asc(operators.name));
  const lineList = await db.select().from(lines).orderBy(asc(lines.displayOrder));

  const allStationLines = await db
    .select({
      lineId: stationLines.lineId,
      id: stations.id,
      name: stations.name,
      nameEn: stations.nameEn,
      code: stations.code,
      publishedAt: stations.publishedAt,
      stationOrder: stationLines.stationOrder,
    })
    .from(stationLines)
    .innerJoin(stations, eq(stationLines.stationId, stations.id))
    .orderBy(asc(stationLines.lineId), asc(stationLines.stationOrder));

  const stationsByLineId = new Map<string, typeof allStationLines>();
  for (const row of allStationLines) {
    const group = stationsByLineId.get(row.lineId);
    if (group) {
      group.push(row);
    } else {
      stationsByLineId.set(row.lineId, [row]);
    }
  }

  const lineStations = lineList.map((line) => ({
    line,
    stations: stationsByLineId.get(line.id) ?? [],
  }));

  const byOperator = operatorList.map((op) => ({
    operator: op,
    lines: lineStations.filter((ls) => ls.line.operatorId === op.id),
  }));

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>駅</Title>
        <LinkButton href="/stations/new">+ 新規</LinkButton>
      </Group>

      <Stack gap="xl">
        {byOperator.map(({ operator, lines: opLines }) => (
          <div key={operator.id}>
            <Title order={3} mb="sm">{operator.name}</Title>
            <Stack gap="md" ml="md">
              {opLines.map(({ line, stations: stns }) => (
                <div key={line.id}>
                  <Group gap="xs" mb="xs">
                    {line.color && (
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: line.color,
                          display: 'inline-block',
                        }}
                      />
                    )}
                    <Text fw={500}>{line.name}</Text>
                    <Text size="sm" c="dimmed">({stns.length}駅)</Text>
                  </Group>
                  <ScrollArea ml="md">
                    <Table striped highlightOnHover withTableBorder fz="sm">
                      <TableThead>
                        <TableTr>
                          <TableTh>#</TableTh>
                          <TableTh>駅番号</TableTh>
                          <TableTh>駅名</TableTh>
                          <TableTh>駅名（英語）</TableTh>
                          <TableTh>公開</TableTh>
                          <TableTh>設備</TableTh>
                          <TableTh>編集</TableTh>
                        </TableTr>
                      </TableThead>
                      <TableTbody>
                        {stns.map((stn) => (
                          <TableTr key={stn.id}>
                            <TableTd>
                              <Text c="dimmed">{stn.stationOrder}</Text>
                            </TableTd>
                            <TableTd>
                              <Text ff="monospace">{stn.code ?? '-'}</Text>
                            </TableTd>
                            <TableTd>{stn.name}</TableTd>
                            <TableTd>
                              <Text c="dimmed">{stn.nameEn ?? '-'}</Text>
                            </TableTd>
                            <TableTd>
                              <LinkAnchor href={`/stations/${stn.id}/publish`} size="sm">
                                <Badge color={stn.publishedAt ? 'green' : 'gray'} size="sm">
                                  {stn.publishedAt ? '公開中' : '非公開'}
                                </Badge>
                              </LinkAnchor>
                            </TableTd>
                            <TableTd>
                              <LinkAnchor href={`/stations/${stn.id}/facilities`} size="sm">
                                管理
                              </LinkAnchor>
                            </TableTd>
                            <TableTd>
                              <LinkAnchor href={`/stations/${stn.id}/edit`} size="sm" c="dimmed">
                                編集
                              </LinkAnchor>
                            </TableTd>
                          </TableTr>
                        ))}
                      </TableTbody>
                    </Table>
                  </ScrollArea>
                </div>
              ))}
            </Stack>
          </div>
        ))}
      </Stack>
    </div>
  );
}
