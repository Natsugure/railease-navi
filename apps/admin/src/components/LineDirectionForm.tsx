'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Button, Checkbox, Group, NativeSelect, ScrollArea,
  Stack, Text, TextInput, Textarea,
} from '@mantine/core';
import type { DirectionStationOption } from '@/features/line/ports';

type LineDirectionData = {
  id?: string;
  directionType: string;
  representativeStationId: string;
  displayName: string;
  displayNameEn: string;
  terminalStationIds: string[] | null;
  notes: string;
};

type Props = {
  lineId: string;
  initialData?: LineDirectionData;
  isEdit?: boolean;
  stations: DirectionStationOption[];
};

function stationLabel(s: DirectionStationOption) {
  return `${s.name}${s.nameEn ? ` (${s.nameEn})` : ''}${s.code ? ` [${s.code}]` : ''}`;
}

export function LineDirectionForm({ lineId, initialData, isEdit = false, stations }: Props) {
  const router = useRouter();
  const [directionType, setDirectionType] = useState(initialData?.directionType ?? 'inbound');
  const [representativeStationId, setRepresentativeStationId] = useState(
    initialData?.representativeStationId ?? ''
  );
  const [displayName, setDisplayName] = useState(initialData?.displayName ?? '');
  const [displayNameEn, setDisplayNameEn] = useState(initialData?.displayNameEn ?? '');
  const [terminalStationIds, setTerminalStationIds] = useState<string[]>(
    initialData?.terminalStationIds ?? []
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  function toggleTerminalStation(stationId: string) {
    setTerminalStationIds((prev) =>
      prev.includes(stationId) ? prev.filter((id) => id !== stationId) : [...prev, stationId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      directionType,
      representativeStationId,
      displayName,
      displayNameEn: displayNameEn || null,
      terminalStationIds: terminalStationIds.length > 0 ? terminalStationIds : null,
      notes: notes || null,
    };

    const url = isEdit
      ? `/api/lines/${lineId}/directions/${initialData!.id}`
      : `/api/lines/${lineId}/directions`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push(`/lines/${lineId}/directions`);
      router.refresh();
    } else {
      setSubmitting(false);
      alert('保存に失敗しました');
    }
  }

  const stationSelectData = stations.map((s) => ({
    value: s.id,
    label: stationLabel(s),
  }));

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <NativeSelect
          label="方面タイプ"
          data={[
            { value: 'inbound', label: '上り' },
            { value: 'outbound', label: '下り' },
          ]}
          value={directionType}
          onChange={(e) => setDirectionType(e.target.value)}
          required
        />

        <TextInput
          label="表示名（日本語）"
          placeholder="例: 渋谷方面"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />

        <TextInput
          label="表示名（英語）- 任意"
          placeholder="e.g. For Shibuya"
          value={displayNameEn}
          onChange={(e) => setDisplayNameEn(e.target.value)}
        />

        <NativeSelect
          label="代表駅"
          description="この方面を表す代表的な駅（例：渋谷方面の場合は渋谷駅）"
          data={[{ value: '', label: '駅を選択' }, ...stationSelectData]}
          value={representativeStationId}
          onChange={(e) => setRepresentativeStationId(e.target.value)}
          required
        />

        <div>
          <Text size="sm" fw={500} mb="xs">終点駅 - 任意</Text>
          <Text size="xs" c="dimmed" mb="xs">
            この方面の終点となりうる駅を選択してください
          </Text>
          <ScrollArea.Autosize mah={240} type="auto" offsetScrollbars>
            <Stack gap="xs">
              {stations.map((station) => (
                <Checkbox
                  key={station.id}
                  label={stationLabel(station)}
                  checked={terminalStationIds.includes(station.id)}
                  onChange={() => toggleTerminalStation(station.id)}
                />
              ))}
            </Stack>
          </ScrollArea.Autosize>
        </div>

        <Textarea
          label="備考"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '登録'}
          </Button>
          <Button variant="default" onClick={() => router.push(`/lines/${lineId}/directions`)}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
