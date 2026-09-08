'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Group, NativeSelect, NumberInput, Stack, TextInput } from '@mantine/core';
import type { OperatorOption } from '@/features/line/ports';

type LineFormData = {
  name: string;
  nameKana: string | null;
  nameEn: string | null;
  odptRailwayId: string | null;
  slug: string | null;
  lineCode: string | null;
  color: string | null;
  displayOrder: number;
  operatorId: string;
};

// 新規作成と編集を1つのコンポーネントで扱う（OperatorForm と同じ方針）。
// lineId が渡されれば PUT（編集）、無ければ POST /api/lines（新規作成・Issue #88）。
// 新規作成では slug 欄を出さない（公開操作の周辺で確定する。
// docs/domain/station-master-model.md「slug の導出規則」）。
type Props = {
  lineId?: string;
  initialData?: LineFormData;
  operators: OperatorOption[];
};

export function LineForm({ lineId, initialData, operators }: Props) {
  const router = useRouter();
  const isEdit = lineId !== undefined;
  const [name, setName] = useState(initialData?.name ?? '');
  const [nameKana, setNameKana] = useState(initialData?.nameKana ?? '');
  const [nameEn, setNameEn] = useState(initialData?.nameEn ?? '');
  const [odptRailwayId, setOdptRailwayId] = useState(initialData?.odptRailwayId ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [lineCode, setLineCode] = useState(initialData?.lineCode ?? '');
  const [color, setColor] = useState(initialData?.color ?? '');
  const [displayOrder, setDisplayOrder] = useState<number | string>(initialData?.displayOrder ?? 0);
  const [operatorId, setOperatorId] = useState(initialData?.operatorId ?? operators[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const orderValue = typeof displayOrder === 'number' ? displayOrder : 0;
    // slug は編集時のみ送る（新規作成では公開操作の周辺で確定するため body に含めない）。
    const res = await fetch(isEdit ? `/api/lines/${lineId}` : '/api/lines', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        operatorId,
        nameKana: nameKana || null,
        nameEn: nameEn || null,
        odptRailwayId: odptRailwayId || null,
        lineCode: lineCode || null,
        color: color || null,
        displayOrder: orderValue,
        ...(isEdit ? { slug: slug || null } : {}),
      }),
    });

    if (res.ok) {
      router.push('/lines');
      router.refresh();
    } else {
      setSubmitting(false);
      alert('保存に失敗しました');
    }
  }

  const operatorOptions = operators.map((op) => ({ value: op.id, label: op.name }));

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <TextInput
          label="路線名"
          placeholder="例: 銀座線"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextInput
          label="よみがな - 任意"
          placeholder="例: ぎんざせん"
          value={nameKana}
          onChange={(e) => setNameKana(e.target.value)}
        />
        <TextInput
          label="英語名 - 任意"
          placeholder="例: Ginza Line"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
        />
        <NativeSelect
          label="事業者"
          required
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
          data={operatorOptions}
        />
        <TextInput
          label="ODPTコード - 任意"
          placeholder="例: odpt.Railway:TokyoMetro.Ginza"
          value={odptRailwayId}
          onChange={(e) => setOdptRailwayId(e.target.value)}
        />
        {isEdit && (
          <TextInput
            label="スラッグ - 任意"
            placeholder="例: tokyo-metro-ginza"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        )}
        <Group grow>
          <TextInput
            label="路線コード - 任意"
            placeholder="例: G"
            value={lineCode}
            onChange={(e) => setLineCode(e.target.value)}
          />
          <TextInput
            label="カラーコード - 任意"
            placeholder="例: #FF9500"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </Group>
        <NumberInput
          label="表示順 - 任意"
          placeholder="0"
          value={displayOrder}
          onChange={setDisplayOrder}
        />
        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '作成'}
          </Button>
          <Button variant="default" onClick={() => router.push('/lines')}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
