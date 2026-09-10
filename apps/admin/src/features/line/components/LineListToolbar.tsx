'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDebouncedValue } from '@mantine/hooks';
import { Group, NativeSelect, TextInput } from '@mantine/core';
import { buildListHref, type ListHrefState } from '@/shared/list/href';
import type { OperatorOption } from '@/features/line/ports';

// 路線一覧のツールバー（Issue #94）。駅一覧（StationListToolbar）と同じ作法。
// 路線一覧に「路線」セレクトは無い（一覧そのものが路線の集合のため）。

const RESET_PAGE_ON = ['operatorId', 'q'] as const;
const DEFAULTS = { sort: 'displayOrder', order: 'asc' };

type Props = {
  current: ListHrefState;
  operatorId: string;
  q: string;
  operators: OperatorOption[];
};

export function LineListToolbar({ current, operatorId, q, operators }: Props) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(q);
  const [debounced] = useDebouncedValue(searchInput, 400);

  useEffect(() => {
    if (debounced === q) return;
    router.replace(
      buildListHref('/lines', current, { q: debounced || null }, {
        defaults: DEFAULTS,
        resetPageOn: RESET_PAGE_ON,
      }),
    );
  }, [debounced, q, current, router]);

  function handleOperatorChange(next: string) {
    router.push(
      buildListHref('/lines', current, { operatorId: next || null }, {
        defaults: DEFAULTS,
        resetPageOn: RESET_PAGE_ON,
      }),
    );
  }

  const operatorSelect = [
    { value: '', label: 'すべての事業者' },
    ...operators.map((o) => ({ value: o.id, label: o.name })),
  ];

  return (
    <Group mb="md" align="flex-end">
      <NativeSelect
        label="事業者"
        value={operatorId}
        onChange={(e) => handleOperatorChange(e.target.value)}
        data={operatorSelect}
        w={220}
      />
      <TextInput
        label="検索"
        placeholder="路線名・コード・事業者名"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        w={260}
      />
    </Group>
  );
}
