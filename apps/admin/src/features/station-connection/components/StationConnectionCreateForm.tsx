'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, NativeSelect, Stack, Text, Textarea } from '@mantine/core';
import { strollerDifficultyOptions, wheelchairDifficultyOptions } from '@/constants/difficulty';
import type {
  ConnectionCandidateStation, StationConnectionCreateContext,
} from '@/features/station-connection/ports';

// 乗換接続の追加フォーム（#88）。相手駅は事業者 → 路線で段階的に絞る。
// スコープ（選択中の事業者・路線）は URL クエリで保持し、変更のたびに
// router.push でサーバーから候補を取り直す（クライアント fetch を新設しない。#49 の方針）。
type Props = {
  stationId: string;
  operatorId: string;
  lineId: string;
  context: StationConnectionCreateContext;
};

function candidateLabel(s: ConnectionCandidateStation): string {
  return s.code ? `${s.name}（${s.code}）` : s.name;
}

export function StationConnectionCreateForm({ stationId, operatorId, lineId, context }: Props) {
  const router = useRouter();
  const base = `/stations/${stationId}/connections/new`;

  const [connectedStationId, setConnectedStationId] = useState('');
  const [strollerDifficulty, setStrollerDifficulty] = useState('');
  const [wheelchairDifficulty, setWheelchairDifficulty] = useState('');
  const [notesAboutStroller, setNotesAboutStroller] = useState('');
  const [notesAboutWheelchair, setNotesAboutWheelchair] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function selectOperator(next: string) {
    router.push(next ? `${base}?operatorId=${next}` : base);
  }

  function selectLine(next: string) {
    setConnectedStationId('');
    router.push(next ? `${base}?operatorId=${operatorId}&lineId=${next}` : `${base}?operatorId=${operatorId}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connectedStationId) return;
    setSubmitting(true);

    const res = await fetch(`/api/stations/${stationId}/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectedStationId,
        strollerDifficulty: strollerDifficulty || null,
        wheelchairDifficulty: wheelchairDifficulty || null,
        notesAboutStroller: notesAboutStroller || null,
        notesAboutWheelchair: notesAboutWheelchair || null,
      }),
    });

    if (res.ok) {
      router.push(`/stations/${stationId}/edit`);
      router.refresh();
    } else {
      setSubmitting(false);
      alert('保存に失敗しました');
    }
  }

  const operatorSelect = [
    { value: '', label: '— 事業者を選択 —' },
    ...context.operators.map((o) => ({ value: o.id, label: o.name })),
  ];
  const lineSelect = [
    { value: '', label: '— 路線を選択 —' },
    ...context.lines.map((l) => ({ value: l.id, label: l.name })),
  ];
  const candidateSelect = [
    { value: '', label: '— 相手駅を選択 —' },
    ...context.candidates.map((s) => ({ value: s.id, label: candidateLabel(s) })),
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <Text size="sm" c="dimmed">
          {context.stationName} からの乗換接続を追加します。対向（相手駅→この駅）も
          あわせて作成されます。
        </Text>

        <NativeSelect
          label="相手駅の事業者"
          value={operatorId}
          onChange={(e) => selectOperator(e.target.value)}
          data={operatorSelect}
        />
        <NativeSelect
          label="相手駅の路線"
          value={lineId}
          onChange={(e) => selectLine(e.target.value)}
          data={lineSelect}
          disabled={!operatorId}
        />
        <NativeSelect
          label="相手駅"
          required
          value={connectedStationId}
          onChange={(e) => setConnectedStationId(e.target.value)}
          data={candidateSelect}
          disabled={!lineId}
          description={lineId && context.candidates.length === 0 ? 'この路線に駅がありません' : undefined}
        />

        <NativeSelect
          label="ベビーカーの乗換難易度 - 任意"
          value={strollerDifficulty}
          onChange={(e) => setStrollerDifficulty(e.target.value)}
          data={strollerDifficultyOptions}
        />
        <Textarea
          label="ベビーカーの補足 - 任意"
          autosize
          minRows={2}
          value={notesAboutStroller}
          onChange={(e) => setNotesAboutStroller(e.target.value)}
        />
        <NativeSelect
          label="車いすの乗換難易度 - 任意"
          value={wheelchairDifficulty}
          onChange={(e) => setWheelchairDifficulty(e.target.value)}
          data={wheelchairDifficultyOptions}
        />
        <Textarea
          label="車いすの補足 - 任意"
          autosize
          minRows={2}
          value={notesAboutWheelchair}
          onChange={(e) => setNotesAboutWheelchair(e.target.value)}
        />

        <Group gap="sm">
          <Button type="submit" loading={submitting} disabled={!connectedStationId}>
            追加
          </Button>
          <Button variant="default" onClick={() => router.push(`/stations/${stationId}/edit`)}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
