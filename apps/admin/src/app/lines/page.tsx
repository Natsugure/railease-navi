import { ColorSwatch, Group, ScrollArea, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';
import { LinkAnchor, LinkButton } from '@/components/LinkElements';
import { LINE_LIST_SORT_KEYS, type LineListSort } from '@/features/line/ports';
import { LineListToolbar } from '@/features/line/components/LineListToolbar';
import { OperatorPicker } from '@/shared/list/OperatorPicker';
import { ListPagination } from '@/shared/list/ListPagination';
import { SortableTh } from '@/shared/list/SortableTh';
import { parseListParams, parseUuidParam } from '@/shared/list/params';
import type { ListHrefState } from '@/shared/list/href';
import { lineListPageQuery } from '@/di';

const PER_PAGE = 50;
const DEFAULTS: ListHrefState = { sort: 'displayOrder', order: 'asc' };

export default async function LinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const operatorId = parseUuidParam(raw.operatorId) ?? '';
  const params = parseListParams<LineListSort>(raw, {
    sortKeys: LINE_LIST_SORT_KEYS,
    defaultSort: 'displayOrder',
    perPage: PER_PAGE,
  });

  const context = await lineListPageQuery.getListContext(
    { operatorId: operatorId || undefined },
    params,
  );

  const current: ListHrefState = {
    operatorId, q: params.q, sort: params.sort, order: params.order, page: params.page,
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>路線</Title>
        <LinkButton href="/lines/new">+ 新規</LinkButton>
      </Group>

      <LineListToolbar current={current} operatorId={operatorId} q={params.q ?? ''} operators={context.operators} />

      {context.result === null ? (
        <Stack gap="md">
          <Text c="dimmed">事業者を選択するか、路線名で検索してください。</Text>
          <OperatorPicker basePath="/lines" cards={context.operatorCards} />
        </Stack>
      ) : (
        <Stack gap="md">
          {context.scope.operatorName && (
            <Text fw={500}>{context.scope.operatorName}の路線 ({context.result.total}件)</Text>
          )}

          {context.result.total === 0 ? (
            <Text c="dimmed">該当する路線が見つかりません。</Text>
          ) : (
            <>
              <ScrollArea>
                <Table striped highlightOnHover withTableBorder>
                  <TableThead>
                    <TableTr>
                      <SortableTh
                        label="名称" sortKey="name" currentSort={params.sort} currentOrder={params.order}
                        basePath="/lines" current={current} defaults={DEFAULTS}
                      />
                      <SortableTh
                        label="事業者" sortKey="operator" currentSort={params.sort} currentOrder={params.order}
                        basePath="/lines" current={current} defaults={DEFAULTS}
                      />
                      <SortableTh
                        label="コード" sortKey="lineCode" currentSort={params.sort} currentOrder={params.order}
                        basePath="/lines" current={current} defaults={DEFAULTS}
                      />
                      <SortableTh
                        label="表示順" sortKey="displayOrder" currentSort={params.sort} currentOrder={params.order}
                        basePath="/lines" current={current} defaults={DEFAULTS}
                      />
                      <TableTh>駅数</TableTh>
                      <TableTh>操作</TableTh>
                    </TableTr>
                  </TableThead>
                  <TableTbody>
                    {context.result.rows.map((line) => (
                      <TableTr key={line.id}>
                        <TableTd>
                          <Group gap="xs" wrap="nowrap">
                            {line.color && <ColorSwatch color={line.color} size={10} />}
                            {line.name}
                          </Group>
                        </TableTd>
                        <TableTd>
                          <Text size="sm" c="dimmed">{line.operatorName}</Text>
                        </TableTd>
                        <TableTd>
                          <Text size="sm" ff="monospace">{line.lineCode ?? '-'}</Text>
                        </TableTd>
                        <TableTd>
                          <Text size="sm" c="dimmed">{line.stationCount}駅</Text>
                        </TableTd>
                        <TableTd>
                          <LinkAnchor href={`/lines/${line.id}/edit`} size="sm" mr="sm">
                            編集
                          </LinkAnchor>
                          <LinkAnchor href={`/lines/${line.id}/directions`} size="sm" mr="sm">
                            方面を管理
                          </LinkAnchor>
                          <LinkAnchor href={`/lines/${line.id}/adjacencies`} size="sm">
                            隣接を管理
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
                basePath="/lines"
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
