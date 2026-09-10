import Link from 'next/link';
import { Card, SimpleGrid, Text } from '@mantine/core';
import { buildListHref } from '@/shared/list/href';
import type { OperatorCard } from '@/features/station/ports';

// スコープ・検索語のどちらも無い一覧の空状態（Issue #94）。
// 全国10,625駅を無条件に読まない代わりに、まず事業者を選ばせる導線として
// 事業者カード一覧を出す（クエリを伴わないリンクのみ。Server Component）。
type Props = {
  basePath: string;
  cards: OperatorCard[];
};

export function OperatorPicker({ basePath, cards }: Props) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }}>
      {cards.map((operator) => (
        // Card の polymorphic `component` prop に Link を渡すと、Server Component から
        // Client Component へ関数を props として渡すことになり RSC のシリアライズに
        // 失敗する（"Functions cannot be passed directly to Client Components"）。
        // Link で Card を包む（children として渡す）形なら Server Component から
        // 問題なく描画できる。
        <Link
          key={operator.id}
          href={buildListHref(basePath, {}, { operatorId: operator.id })}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <Card shadow="sm" padding="md" withBorder>
            <Text fw={500} size="sm">{operator.name}</Text>
            <Text size="xs" c="dimmed" mt={4}>{operator.lineCount}路線</Text>
          </Card>
        </Link>
      ))}
    </SimpleGrid>
  );
}
