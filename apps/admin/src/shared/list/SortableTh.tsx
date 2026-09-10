'use client';

import { useRouter } from 'next/navigation';
import { Group, TableTh, Text, UnstyledButton } from '@mantine/core';
import { buildListHref, type ListHrefState } from './href';
import type { SortOrder } from './params';

// クリックでソートを切り替えるテーブルヘッダ（Issue #94）。
// Mantine の Table に組み込みソートは無いため自前実装する（Issue #94 の推奨案(a)）。
// 状態は URL クエリに置く（router.push）。
//
// Server Component から関数 props は渡せないため（シリアライズ不可）、href は
// この Client Component の内部で buildListHref を使って組み立てる。呼び出し側は
// 現在の URL 状態（current）をデータとして渡すだけでよい。
type Props<TSort extends string> = {
  label: string;
  sortKey: TSort;
  currentSort: TSort;
  currentOrder: SortOrder;
  basePath: string;
  current: ListHrefState;
  defaults?: ListHrefState;
};

export function SortableTh<TSort extends string>({
  label, sortKey, currentSort, currentOrder, basePath, current, defaults,
}: Props<TSort>) {
  const router = useRouter();
  const active = currentSort === sortKey;
  const nextOrder: SortOrder = active && currentOrder === 'asc' ? 'desc' : 'asc';
  const href = buildListHref(basePath, current, { sort: sortKey, order: nextOrder }, {
    defaults,
    resetPageOn: ['sort', 'order'],
  });

  return (
    <TableTh aria-sort={active ? (currentOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <UnstyledButton onClick={() => router.push(href)} aria-label={`${label}で並び替え`}>
        <Group gap={4} wrap="nowrap">
          <Text fw={active ? 700 : 400} size="sm">{label}</Text>
          {active && <Text size="xs" c="dimmed">{currentOrder === 'asc' ? '▲' : '▼'}</Text>}
        </Group>
      </UnstyledButton>
    </TableTh>
  );
}
