'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button, Group, NativeSelect, NumberInput, SimpleGrid, Stack, Text, TextInput, Textarea,
} from '@mantine/core';
import type {
  LineOption, OperatorOption, StationGroupOption,
} from '@/features/station/ports';

// 駅の新規作成専用の軽量フォーム（#88）。既存の StationEditForm は
// 乗換接続の複数 PUT 分裂を抱えるため流用しない。ここでは stations + stationLines の
// 1行ずつを作るのに必要な項目だけを扱う。
//
// slug 欄は無い。新規駅は publishedAt = NULL / slug = NULL で作られ、
// /stations/[stationId]/publish で管理者が公開と slug を確定する
// （docs/domain/station-master-model.md「slug の導出規則」）。
type Props = {
  operators: OperatorOption[];
  lines: LineOption[];
  stationGroups: StationGroupOption[];
  // ページの searchParams から復元。グループ選択肢のスコープに使う
  prefCode: number | null;
};

export function StationCreateForm({ operators, lines, stationGroups, prefCode }: Props) {
  const router = useRouter();

  const [operatorId, setOperatorId] = useState(operators[0]?.id ?? '');
  const linesForOperator = useMemo(
    () => lines.filter((l) => l.operatorId === operatorId),
    [lines, operatorId],
  );
  const [lineId, setLineId] = useState(linesForOperator[0]?.id ?? '');

  const [name, setName] = useState('');
  const [nameKana, setNameKana] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [code, setCode] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [odptStationId, setOdptStationId] = useState('');
  const [stationOrder, setStationOrder] = useState<number | string>('');
  const [stationGroupId, setStationGroupId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 事業者を変えたら、その事業者の先頭路線に寄せる（未所属状態を残さない）
  function handleOperatorChange(next: string) {
    setOperatorId(next);
    const first = lines.find((l) => l.operatorId === next);
    setLineId(first?.id ?? '');
  }

  // 都道府県を変えたら URL クエリを更新してグループ選択肢をサーバーから取り直す
  // （クライアント側 fetch を新設しない。#49 の方針）
  function handlePrefCodeChange(value: number | string) {
    const v = typeof value === 'number' ? value : '';
    setStationGroupId('');
    router.push(v === '' ? '/stations/new' : `/stations/new?prefCode=${v}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch('/api/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        operatorId,
        lineId,
        nameKana: nameKana || null,
        nameEn: nameEn || null,
        code: code || null,
        lat: lat || null,
        lon: lon || null,
        odptStationId: odptStationId || null,
        prefCode: prefCode ?? null,
        stationGroupId: stationGroupId || null,
        stationOrder: typeof stationOrder === 'number' ? stationOrder : null,
        notes: notes || null,
      }),
    });

    if (res.ok) {
      router.push('/stations');
      router.refresh();
    } else {
      setSubmitting(false);
      alert('保存に失敗しました');
    }
  }

  const operatorOptions = operators.map((op) => ({ value: op.id, label: op.name }));
  const lineOptions = linesForOperator.map((l) => ({ value: l.id, label: l.name }));
  const groupOptions = [
    { value: '', label: '— 紐付けない —' },
    ...stationGroups.map((g) => ({ value: g.id, label: g.name })),
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <TextInput
          label="駅名"
          placeholder="例: 銀座"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="よみがな - 任意"
            placeholder="例: ぎんざ"
            value={nameKana}
            onChange={(e) => setNameKana(e.target.value)}
          />
          <TextInput
            label="英語名 - 任意（事業者公式表記のみ）"
            placeholder="例: Ginza"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </SimpleGrid>
        <NativeSelect
          label="事業者"
          required
          value={operatorId}
          onChange={(e) => handleOperatorChange(e.target.value)}
          data={operatorOptions}
        />
        <NativeSelect
          label="路線"
          required
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          data={lineOptions}
          description={
            lineOptions.length === 0 ? 'この事業者には路線がありません。先に路線を作成してください。' : undefined
          }
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="駅番号 - 任意"
            placeholder="例: G09"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <NumberInput
            label="路線内順序 - 任意"
            placeholder="例: 9"
            value={stationOrder}
            onChange={setStationOrder}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="緯度 - 任意"
            placeholder="例: 35.671989"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
          <TextInput
            label="経度 - 任意"
            placeholder="例: 139.763965"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
          />
        </SimpleGrid>
        <TextInput
          label="ODPT駅コード - 任意"
          placeholder="例: odpt.Station:TokyoMetro.Ginza.Ginza"
          value={odptStationId}
          onChange={(e) => setOdptStationId(e.target.value)}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput
            label="都道府県コード - 任意"
            description="乗換単位グループの候補を絞り込む"
            placeholder="例: 13"
            value={prefCode ?? ''}
            onChange={handlePrefCodeChange}
          />
          <NativeSelect
            label="乗換単位グループ - 任意"
            value={stationGroupId}
            onChange={(e) => setStationGroupId(e.target.value)}
            data={groupOptions}
            description={
              prefCode === null ? '先に都道府県コードを入力すると候補が出ます' : undefined
            }
          />
        </SimpleGrid>
        <Textarea
          label="メモ - 任意"
          autosize
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Text size="sm" c="dimmed">
          新規駅は非公開（slug 未設定）で作成されます。公開は「公開」画面から行ってください。
        </Text>
        <Group gap="sm">
          <Button type="submit" loading={submitting} disabled={lineOptions.length === 0}>
            作成
          </Button>
          <Button variant="default" onClick={() => router.push('/stations')}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
