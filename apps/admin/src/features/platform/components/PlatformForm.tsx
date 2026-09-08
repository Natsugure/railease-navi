'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Button, Group, NativeSelect, NumberInput, Stack, Text, TextInput, Textarea,
} from '@mantine/core';
import type { LineWithDirections } from '@/features/platform/ports';

type PlatformData = {
  id?: string;
  platformNumber: string;
  lineId: string;
  inboundDirectionId: string | null;
  outboundDirectionId: string | null;
  physicalLength: number;
  platformSide: string | null;
  notes: string;
};

type Props = {
  stationId: string;
  initialData?: PlatformData;
  isEdit?: boolean;
  lines: LineWithDirections[];
};

export function PlatformForm({ stationId, initialData, isEdit = false, lines }: Props) {
  const router = useRouter();
  const [platformNumber, setPlatformNumber] = useState(initialData?.platformNumber ?? '');
  const [lineId, setLineId] = useState(initialData?.lineId ?? '');
  const [inboundDirectionId, setInboundDirectionId] = useState<string>(
    initialData?.inboundDirectionId ?? ''
  );
  const [outboundDirectionId, setOutboundDirectionId] = useState<string>(
    initialData?.outboundDirectionId ?? ''
  );
  const [physicalLength, setPhysicalLength] = useState(initialData?.physicalLength ?? 0);
  const [platformSide, setPlatformSide] = useState<string>(
    initialData?.platformSide ?? ''
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    // physicalLength は既存行の未入力を表す暫定値として 0 を許容しているが
    // （docs/domain/platform-coordinate-system.md「ホームの物理長」。'0' = 未入力）、
    // 新規入力としては受け付けない（features/platform/schema.ts の positive() と揃える）。
    if (physicalLength <= 0) {
      setErrorMessage('ホーム長は0より大きい値を入力してください');
      return;
    }

    setSubmitting(true);

    const payload = {
      platformNumber,
      lineId,
      inboundDirectionId: inboundDirectionId || null,
      outboundDirectionId: outboundDirectionId || null,
      physicalLength,
      platformSide: platformSide || null,
      notes: notes || null,
    };

    const url = isEdit
      ? `/api/stations/${stationId}/platforms/${initialData!.id}`
      : `/api/stations/${stationId}/platforms`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push(`/stations/${stationId}/facilities`);
      router.refresh();
    } else {
      setSubmitting(false);
      setErrorMessage('保存に失敗しました');
    }
  }

  // 方面は選択中の路線からの純粋な派生値（props で全路線ぶんネストされて渡る）。
  // 路線切替時の fetch とレースが不要になった（#49 / #32）
  const selectedLine = lines.find((l) => l.id === lineId);
  const inboundDirections = selectedLine?.inboundDirections ?? [];
  const outboundDirections = selectedLine?.outboundDirections ?? [];

  const lineSelectData = [
    { value: '', label: '路線を選択' },
    ...lines.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <TextInput
          label="ホーム番号"
          placeholder="例: 1, 2a"
          value={platformNumber}
          onChange={(e) => setPlatformNumber(e.target.value)}
          required
          w={{ base: '100%', xs: 128 }}
        />

        <div>
          <NativeSelect
            label="路線"
            data={lineSelectData}
            value={lineId}
            onChange={(e) => {
              setLineId(e.target.value);
              setInboundDirectionId('');
              setOutboundDirectionId('');
            }}
            required
          />
          {/* 選択肢はこの駅の stationLines に載る路線だけ。0件だと理由が分からないまま
              required で詰まるので、原因を示す */}
          {lines.length === 0 && (
            <Text size="xs" c="dimmed" mt={4}>
              この駅に紐づく路線が登録されていません。先に駅と路線の対応を登録してください。
            </Text>
          )}
        </div>

        {lineId && (
          <>
            <div>
              <NativeSelect
                label="上り方面（任意）"
                data={[
                  { value: '', label: 'なし' },
                  ...inboundDirections.map((d) => ({ value: d.id, label: d.displayName })),
                ]}
                value={inboundDirectionId}
                onChange={(e) => setInboundDirectionId(e.target.value)}
              />
              {inboundDirections.length === 0 && (
                <Text size="xs" c="dimmed" mt="xs">
                  この路線に上り方面が定義されていません。先に作成してください。
                </Text>
              )}
            </div>

            <div>
              <NativeSelect
                label="下り方面（任意）"
                data={[
                  { value: '', label: 'なし' },
                  ...outboundDirections.map((d) => ({ value: d.id, label: d.displayName })),
                ]}
                value={outboundDirectionId}
                onChange={(e) => setOutboundDirectionId(e.target.value)}
              />
              {outboundDirections.length === 0 && (
                <Text size="xs" c="dimmed" mt="xs">
                  この路線に下り方面が定義されていません。先に作成してください。
                </Text>
              )}
            </div>
          </>
        )}

        <NumberInput
          label="ホームの物理長"
          description="メートル単位。ホームの実体は 0 からこの値までの区間として扱われます。0 は未入力を意味する暫定値のため、新規登録では0より大きい値を入力してください"
          min={0}
          step={0.1}
          decimalScale={2}
          suffix=" m"
          value={physicalLength}
          onChange={(v) => setPhysicalLength(typeof v === 'number' ? v : 0)}
          required
          w={{ base: '100%', xs: 160 }}
        />

        <NativeSelect
          label="ホーム位置"
          description="可視化で列車図の上下どちらにホーム帯を表示するか"
          data={[
            { value: '', label: '未設定（デフォルト: 下）' },
            { value: 'bottom', label: 'bottom（列車の下側）' },
            { value: 'top', label: 'top（列車の上側）' },
          ]}
          value={platformSide}
          onChange={(e) => setPlatformSide(e.target.value)}
          w={{ base: '100%', sm: 256 }}
        />

        <Textarea
          label="備考"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {errorMessage && (
          <Text size="sm" c="red">{errorMessage}</Text>
        )}

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '登録'}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => router.push(`/stations/${stationId}/facilities`)}
          >
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
