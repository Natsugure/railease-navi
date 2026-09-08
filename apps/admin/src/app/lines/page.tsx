import { db } from '@furatora/database/client';
import { lines, operators } from '@furatora/database/schema';
import { asc } from 'drizzle-orm';
import { LinkAnchor, LinkButton } from '@/components/LinkElements';
import { Group, ScrollArea, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';

export default async function LinesPage() {
  const lineList = await db.select().from(lines).orderBy(asc(lines.displayOrder));
  const operatorList = await db.select().from(operators);
  const operatorMap = Object.fromEntries(operatorList.map((op) => [op.id, op.name]));

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>路線</Title>
        <LinkButton href="/lines/new">+ 新規</LinkButton>
      </Group>

      {lineList.length === 0 ? (
        <Text c="dimmed">路線が見つかりません。</Text>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <TableThead>
              <TableTr>
                <TableTh>名称</TableTh>
                <TableTh>事業者</TableTh>
                <TableTh>コード</TableTh>
                <TableTh>操作</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {lineList.map((line) => (
                <TableTr key={line.id}>
                  <TableTd>{line.name}</TableTd>
                  <TableTd>
                    <Text size="sm" c="dimmed">{operatorMap[line.operatorId] ?? '-'}</Text>
                  </TableTd>
                  <TableTd>
                    <Text size="sm" ff="monospace">{line.lineCode ?? '-'}</Text>
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
      )}
    </div>
  );
}
