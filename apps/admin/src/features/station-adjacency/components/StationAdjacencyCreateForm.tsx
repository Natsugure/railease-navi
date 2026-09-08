'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, NativeSelect } from '@mantine/core';
import type { AdjacencyLineStation } from '@/features/station-adjacency/ports';

// 路線内の隣接を1辺追加するフォーム（#88）。当該路線の駅どうしから2つ選ぶ。
// 端点の順序は問わない（サーバー側が昇順正規化する）。
type Props = {
  lineId: string;
  stations: AdjacencyLineStation[];
};

export function StationAdjacencyCreateForm({ lineId, stations }: Props) {
  const router = useRouter();
  const [stationAId, setStationAId] = useState('');
  const [stationBId, setStationBId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stationAId || !stationBId) return;
    setSubmitting(true);

    const res = await fetch(`/api/lines/${lineId}/adjacencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationAId, stationBId }),
    });

    setSubmitting(false);
    if (res.ok) {
      setStationAId('');
      setStationBId('');
      router.refresh();
    } else if (res.status === 400) {
      alert('同じ駅どうしは隣接にできません');
    } else {
      alert('追加に失敗しました');
    }
  }

  const options = [
    { value: '', label: '— 駅を選択 —' },
    ...stations.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Group align="flex-end" gap="sm" wrap="wrap">
        <NativeSelect
          label="駅1"
          value={stationAId}
          onChange={(e) => setStationAId(e.target.value)}
          data={options}
        />
        <NativeSelect
          label="駅2"
          value={stationBId}
          onChange={(e) => setStationBId(e.target.value)}
          data={options}
        />
        <Button type="submit" loading={submitting} disabled={!stationAId || !stationBId}>
          隣接を追加
        </Button>
      </Group>
    </form>
  );
}
