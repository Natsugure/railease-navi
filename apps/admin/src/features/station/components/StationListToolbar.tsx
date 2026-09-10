'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDebouncedValue } from '@mantine/hooks';
import { Group, NativeSelect, TextInput } from '@mantine/core';
import { buildListHref, type ListHrefState } from '@/shared/list/href';
import type { LineOption, OperatorOption } from '@/features/station/ports';

// 駅一覧のツールバー（Issue #94）。状態は URL クエリに置き、useState はこの
// コンポーネント内の入力途中の値（検索語のデバウンス）にのみ使う。
// 事業者・路線の変更は router.push（履歴に残す）、検索語の変更は入力のたびに
// 履歴を汚さないよう router.replace で反映する。

const RESET_PAGE_ON = ['operatorId', 'lineId', 'q'] as const;

type Props = {
  current: ListHrefState;
  defaults: ListHrefState;
  operatorId: string;
  lineId: string;
  q: string;
  operators: OperatorOption[];
  lines: LineOption[];
};

export function StationListToolbar({ current, defaults, operatorId, lineId, q, operators, lines }: Props) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(q);
  const [debounced] = useDebouncedValue(searchInput, 400);

  useEffect(() => {
    if (debounced === q) return;
    router.replace(
      buildListHref('/stations', current, { q: debounced || null }, {
        defaults,
        resetPageOn: RESET_PAGE_ON,
      }),
    );
  }, [debounced, q, current, defaults, router]);

  function handleOperatorChange(next: string) {
    router.push(
      buildListHref('/stations', current, { operatorId: next || null, lineId: null }, {
        defaults,
        resetPageOn: RESET_PAGE_ON,
      }),
    );
  }

  function handleLineChange(next: string) {
    router.push(
      buildListHref('/stations', current, { lineId: next || null }, {
        defaults,
        resetPageOn: RESET_PAGE_ON,
      }),
    );
  }

  const operatorSelect = [
    { value: '', label: 'すべての事業者' },
    ...operators.map((o) => ({ value: o.id, label: o.name })),
  ];
  const lineSelect = [
    { value: '', label: 'すべての路線' },
    ...lines.map((l) => ({ value: l.id, label: l.name })),
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
      <NativeSelect
        label="路線"
        value={lineId}
        onChange={(e) => handleLineChange(e.target.value)}
        data={lineSelect}
        disabled={!operatorId}
        description={operatorId && lines.length === 0 ? 'この事業者に路線がありません' : undefined}
        w={220}
      />
      <TextInput
        label="検索"
        placeholder="駅名・英名・駅番号"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        w={260}
      />
    </Group>
  );
}
