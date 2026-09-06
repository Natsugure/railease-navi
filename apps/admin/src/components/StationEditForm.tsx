'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StrollerDifficulty, WheelchairDifficulty } from '@furatora/database/enums';
import { STROLLER_DIFFICULTY_META, WHEELCHAIR_DIFFICULTY_META } from '@/constants/difficulty';
import type { ConnectionRow, OperatorOption } from '@/features/station/ports';
import {
  Button, Card, Group, NativeSelect, SimpleGrid, Stack, Text, TextInput, Textarea, Title,
} from '@mantine/core';

export type { ConnectionRow } from '@/features/station/ports';

type ConnectionState = {
  strollerDifficulty: StrollerDifficulty | '';
  wheelchairDifficulty: WheelchairDifficulty | '';
  notesAboutStroller: string;
  notesAboutWheelchair: string;
};

// 接続 ID を持つ行の配列で保持する。Record にすると noUncheckedIndexedAccess 下で
// キーアクセスが T | undefined になるが、行は connections から1対1で導出されるため
// 配列 + find の方が「必ず存在する」ことを表現しやすい（Issue #50）。
type ConnectionStateRow = ConnectionState & { id: string };

type Props = {
  stationId: string;
  initialData: {
    name: string;
    nameKana: string | null;
    nameEn: string | null;
    odptStationId: string | null;
    slug: string | null;
    code: string | null;
    lat: string | null;
    lon: string | null;
    operatorId: string;
    notes: string | null;
  };
  connections: ConnectionRow[];
  operators: OperatorOption[];
};

function displayName(conn: ConnectionRow): string {
  if (conn.connectedStationName && conn.connectedLineName) {
    return `${conn.connectedLineName} — ${conn.connectedStationName}`;
  }
  if (conn.connectedLineName) return conn.connectedLineName;
  if (conn.connectedStationName) return conn.connectedStationName;
  return '(不明)';
}

const strollerOptions = [
  { value: '', label: '— 未設定 —' },
  ...Object.entries(STROLLER_DIFFICULTY_META)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, { label }]) => ({ value: key, label })),
];

const wheelchairOptions = [
  { value: '', label: '— 未設定 —' },
  ...Object.entries(WHEELCHAIR_DIFFICULTY_META)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, { label }]) => ({ value: key, label })),
];

export function StationEditForm({ stationId, initialData, connections, operators }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialData.name);
  const [nameKana, setNameKana] = useState(initialData.nameKana ?? '');
  const [nameEn, setNameEn] = useState(initialData.nameEn ?? '');
  const [odptStationId, setOdptStationId] = useState(initialData.odptStationId ?? '');
  const [slug, setSlug] = useState(initialData.slug ?? '');
  const [code, setCode] = useState(initialData.code ?? '');
  const [lat, setLat] = useState(initialData.lat ?? '');
  const [lon, setLon] = useState(initialData.lon ?? '');
  const [operatorId, setOperatorId] = useState(initialData.operatorId);
  const [notes, setNotes] = useState(initialData.notes ?? '');
  const [connectionStates, setConnectionStates] = useState<ConnectionStateRow[]>(() =>
    connections.map((c) => ({
      id: c.id,
      strollerDifficulty: c.strollerDifficulty ?? '',
      wheelchairDifficulty: c.wheelchairDifficulty ?? '',
      notesAboutStroller: c.notesAboutStroller ?? '',
      notesAboutWheelchair: c.notesAboutWheelchair ?? '',
    }))
  );
  const [submitting, setSubmitting] = useState(false);

  function updateConnection(id: string, patch: Partial<ConnectionState>) {
    setConnectionStates((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function handleSave() {
    setSubmitting(true);

    const stationReq = fetch(`/api/stations/${stationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        nameKana: nameKana || null,
        nameEn: nameEn || null,
        odptStationId: odptStationId || null,
        slug: slug || null,
        code: code || null,
        lat: lat || null,
        lon: lon || null,
        operatorId,
        notes: notes || null,
      }),
    });

    const connectionReqs = connectionStates.map((s) =>
      fetch(`/api/station-connections/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strollerDifficulty: s.strollerDifficulty || null,
          wheelchairDifficulty: s.wheelchairDifficulty || null,
          notesAboutStroller: s.notesAboutStroller || null,
          notesAboutWheelchair: s.notesAboutWheelchair || null,
        }),
      })
    );

    const results = await Promise.all([stationReq, ...connectionReqs]);
    const allOk = results.every((r) => r.ok);

    if (allOk) {
      router.push('/stations');
      router.refresh();
    } else {
      setSubmitting(false);
      alert('保存に失敗しました');
    }
  }

  const operatorOptions = operators.map((op) => ({ value: op.id, label: op.name }));

  return (
    <Stack gap="xl" maw="48rem">
      <section>
        <Title order={4} mb="md">駅情報</Title>
        <Stack gap="md">
          <TextInput
            label="駅名"
            placeholder="例: 茅場町"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextInput
            label="よみがな - 任意"
            placeholder="例: かやばちょう"
            value={nameKana}
            onChange={(e) => setNameKana(e.target.value)}
          />
          <TextInput
            label="英語名 - 任意"
            placeholder="例: Kayabacho"
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
            placeholder="例: odpt.Station:TokyoMetro.Hibiya.Kayabacho"
            value={odptStationId}
            onChange={(e) => setOdptStationId(e.target.value)}
          />
          <TextInput
            label="スラッグ - 任意"
            placeholder="例: tokyo-metro-hibiya-kayabacho"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <TextInput
            label="駅コード - 任意"
            placeholder="例: H14"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <SimpleGrid cols={2}>
            <TextInput
              label="緯度 - 任意"
              placeholder="例: 35.681236"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
            <TextInput
              label="経度 - 任意"
              placeholder="例: 139.767125"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
            />
          </SimpleGrid>
          <Textarea
            label="備考 - 任意"
            placeholder="例: 東急東横線との直通運転あり"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Stack>
      </section>

      <section>
        <Title order={4} mb="md">
          乗り換え接続 ({connections.length}件)
        </Title>

        {connections.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">乗り換え接続情報がありません</Text>
        ) : (
          <Stack gap="lg">
            {connections.map((conn) => {
              const s = connectionStates.find((cs) => cs.id === conn.id);
              if (!s) return null;
              return (
                <Card key={conn.id} withBorder padding="md">
                  <Text fw={500} size="sm" mb="md">{displayName(conn)}</Text>

                  <SimpleGrid cols={2} mb="md">
                    <NativeSelect
                      label="ベビーカー難易度"
                      data={strollerOptions}
                      value={s.strollerDifficulty}
                      onChange={(e) =>
                        updateConnection(conn.id, {
                          strollerDifficulty: e.target.value as StrollerDifficulty | '',
                        })
                      }
                    />
                    <NativeSelect
                      label="車いす難易度"
                      data={wheelchairOptions}
                      value={s.wheelchairDifficulty}
                      onChange={(e) =>
                        updateConnection(conn.id, {
                          wheelchairDifficulty: e.target.value as WheelchairDifficulty | '',
                        })
                      }
                    />
                  </SimpleGrid>

                  <SimpleGrid cols={2}>
                    <Textarea
                      label="ベビーカー備考"
                      placeholder="例: A2出口エレベーターを利用"
                      rows={2}
                      value={s.notesAboutStroller}
                      onChange={(e) =>
                        updateConnection(conn.id, { notesAboutStroller: e.target.value })
                      }
                    />
                    <Textarea
                      label="車いす備考"
                      placeholder="例: 駅員への申告が必要"
                      rows={2}
                      value={s.notesAboutWheelchair}
                      onChange={(e) =>
                        updateConnection(conn.id, { notesAboutWheelchair: e.target.value })
                      }
                    />
                  </SimpleGrid>
                </Card>
              );
            })}
          </Stack>
        )}
      </section>

      <Group gap="sm">
        <Button loading={submitting} onClick={handleSave}>
          保存
        </Button>
        <Button variant="default" onClick={() => router.push('/stations')}>
          キャンセル
        </Button>
      </Group>
    </Stack>
  );
}
