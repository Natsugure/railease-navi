'use client';

import { useRouter } from 'next/navigation';
import { Group, Pagination, Text } from '@mantine/core';
import { buildListHref, type ListHrefState } from './href';

// ページング（Issue #94）。総件数と現在のレンジを添え、router.push で URL の
// page を書き換える。href は SortableTh と同じ理由で内部で組み立てる
// （Server Component から関数 props は渡せない）。
type Props = {
  total: number;
  page: number;
  perPage: number;
  basePath: string;
  current: ListHrefState;
  defaults?: ListHrefState;
};

export function ListPagination({ total, page, perPage, basePath, current, defaults }: Props) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (total === 0) return null;

  // page がURL操作等で総ページ数の範囲外になっていても、表示上は範囲内にクランプする。
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const rangeStart = (currentPage - 1) * perPage + 1;
  const rangeEnd = Math.min(total, currentPage * perPage);

  return (
    <Group justify="space-between" mt="md">
      <Text size="sm" c="dimmed">
        {total.toLocaleString('ja-JP')}件中 {rangeStart.toLocaleString('ja-JP')}–{rangeEnd.toLocaleString('ja-JP')}件
      </Text>
      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={(next) => router.push(
            buildListHref(basePath, current, { page: next }, { defaults: { ...defaults, page: 1 } }),
          )}
        />
      )}
    </Group>
  );
}
