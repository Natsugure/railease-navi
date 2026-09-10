import { Badge, ColorSwatch, Group, ScrollArea, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';
import { LinkAnchor, LinkButton } from '@/components/LinkElements';
import { STATION_LIST_SORT_KEYS, type StationListSort } from '@/features/station/ports';
import { OperatorPicker } from '@/features/station/components/OperatorPicker';
import { StationListToolbar } from '@/features/station/components/StationListToolbar';
import { ListPagination } from '@/shared/list/ListPagination';
import { SortableTh } from '@/shared/list/SortableTh';
import { parseListParams, parseUuidParam } from '@/shared/list/params';
import type { ListHrefState } from '@/shared/list/href';
import { stationListPageQuery } from '@/di';

const PER_PAGE = 50;
const DEFAULTS: ListHrefState = { sort: 'line', order: 'asc' };

export default async function StationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const operatorId = parseUuidParam(raw.operatorId) ?? '';
  const lineId = parseUuidParam(raw.lineId) ?? '';
  const params = parseListParams<StationListSort>(raw, {
    sortKeys: STATION_LIST_SORT_KEYS,
    defaultSort: 'line',
    perPage: PER_PAGE,
  });

  const context = await stationListPageQuery.getListContext(
    { operatorId: operatorId || undefined, lineId: lineId || undefined },
    params,
  );

  const current: ListHrefState = {
    operatorId, lineId, q: params.q, sort: params.sort, order: params.order, page: params.page,
  };

  // 路線が確定している（lineId 選択済み）ときだけ「路線」列を隠して見出しに出す。
  // 事業者すら未選択（全国横断検索）のときは「事業者」列も出す。
  const showOperatorColumn = !operatorId;
  const showLineColumn = !lineId;

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>駅</Title>
        <LinkButton href="/stations/new">+ 新規</LinkButton>
      </Group>

      <StationListToolbar
        current={current}
        defaults={DEFAULTS}
        operatorId={operatorId}
        lineId={lineId}
        q={params.q ?? ''}
        operators={context.operators}
        lines={context.lines}
      />

      {context.result === null ? (
        <Stack gap="md">
          <Text c="dimmed">事業者を選択するか、駅名で検索してください。</Text>
          <OperatorPicker basePath="/stations" cards={context.operatorCards} />
        </Stack>
      ) : (
        <Stack gap="md">
          {context.scope.lineName ? (
            <Group gap="xs">
              {context.scope.lineColor && (
                <ColorSwatch color={context.scope.lineColor} size={12} />
              )}
              <Text fw={500}>{context.scope.lineName}</Text>
              <Text size="sm" c="dimmed">({context.result.total}駅)</Text>
            </Group>
          ) : context.scope.operatorName ? (
            <Text fw={500}>{context.scope.operatorName}の駅（{context.result.total}件）</Text>
          ) : null}

          {context.result.total === 0 ? (
            <Text c="dimmed">該当する駅が見つかりません。</Text>
          ) : (
            <>
              <ScrollArea>
                <Table striped highlightOnHover withTableBorder fz="sm">
                  <TableThead>
                    <TableTr>
                      <SortableTh
                        label="駅番号" sortKey="code" currentSort={params.sort} currentOrder={params.order}
                        basePath="/stations" current={current} defaults={DEFAULTS}
                      />
                      <SortableTh
                        label="駅名" sortKey="name" currentSort={params.sort} currentOrder={params.order}
                        basePath="/stations" current={current} defaults={DEFAULTS}
                      />
                      <TableTh>駅名（英語）</TableTh>
                      {showOperatorColumn && <TableTh>事業者</TableTh>}
                      {showLineColumn && (
                        <SortableTh
                          label="路線" sortKey="line" currentSort={params.sort} currentOrder={params.order}
                          basePath="/stations" current={current} defaults={DEFAULTS}
                        />
                      )}
                      <SortableTh
                        label="公開" sortKey="published" currentSort={params.sort} currentOrder={params.order}
                        basePath="/stations" current={current} defaults={DEFAULTS}
                      />
                      <TableTh>設備</TableTh>
                      <TableTh>編集</TableTh>
                    </TableTr>
                  </TableThead>
                  <TableTbody>
                    {context.result.rows.map((stn) => (
                      <TableTr key={stn.id}>
                        <TableTd>
                          <Text ff="monospace">{stn.code ?? '-'}</Text>
                        </TableTd>
                        <TableTd>{stn.name}</TableTd>
                        <TableTd>
                          <Text c="dimmed">{stn.nameEn ?? '-'}</Text>
                        </TableTd>
                        {showOperatorColumn && (
                          <TableTd>
                            <Text size="sm" c="dimmed">{stn.operatorName}</Text>
                          </TableTd>
                        )}
                        {showLineColumn && (
                          <TableTd>
                            <Group gap="xs" wrap="nowrap">
                              {stn.lineColor && (
                                <ColorSwatch color={stn.lineColor} size={10} />
                              )}
                              <Text size="sm">{stn.lineName}</Text>
                            </Group>
                          </TableTd>
                        )}
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

              <ListPagination
                total={context.result.total}
                page={context.result.page}
                perPage={context.result.perPage}
                basePath="/stations"
                current={current}
                defaults={DEFAULTS}
              />
            </>
          )}
        </Stack>
      )}
    </div>
  );
}
