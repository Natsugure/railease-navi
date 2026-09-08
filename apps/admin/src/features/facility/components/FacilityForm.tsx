'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Button, Card, Checkbox, Collapse, Group, NativeSelect,
  NumberInput, Stack, Text, TextInput, Textarea, Title,
} from '@mantine/core';
import type {
  FacilityPlatformOption, FacilityTypeOption, ConnectedStationOption, FacilityLocationDTO,
} from '@/features/facility/ports';

type FacilitySelection = {
  typeCode: string;
  isWheelchairAccessible: boolean;
  isStrollerAccessible: boolean;
  notes: string;
};

type CellState = {
  xPositionMeters: number | '';
  facilities: FacilitySelection[];
};

type ConnectionRowState = {
  stationId: string;
  connectedPlatformId: string | null;
  directionId: string | null;
  notes: string;
  xRangeStart: number | '';
  xRangeEnd: number | '';
  checked: boolean;
};

type Props = {
  stationId: string;
  initialData?: FacilityLocationDTO;
  isEdit?: boolean;
  platforms: FacilityPlatformOption[];
  facilityTypes: FacilityTypeOption[];
  connectedStations: ConnectedStationOption[];
};

// 接続候補駅すべてを行として展開し、既存の接続があればその値を反映する。
// 従来 useEffect の中でクライアント fetch 結果と組み合わせていた処理を、
// props からの純粋な組み立てにした（#49）。
function buildConnectionRows(
  connectedStations: ConnectedStationOption[],
  connections: FacilityLocationDTO['connections'] | undefined,
): ConnectionRowState[] {
  return connectedStations.map((station) => {
    const existing = connections?.find((c) => c.stationId === station.id);
    return {
      stationId: station.id,
      connectedPlatformId: existing?.connectedPlatformId ?? null,
      directionId: existing?.directionId ?? null,
      notes: existing?.exitLabel ?? '',
      xRangeStart: existing?.xRangeStart ?? '',
      xRangeEnd: existing?.xRangeEnd ?? '',
      checked: !!existing,
    };
  });
}

export function FacilityForm({
  stationId, initialData, isEdit = false, platforms, facilityTypes, connectedStations,
}: Props) {
  const router = useRouter();

  const [platformId, setPlatformId] = useState(initialData?.platformId ?? '');
  const [exits, setExits] = useState(initialData?.exits ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [cells, setCells] = useState<CellState[]>(
    () =>
      initialData?.cells.map((c) => ({
        xPositionMeters: c.xPositionMeters ?? '',
        facilities: c.facilities,
      })) ?? [{ xPositionMeters: '', facilities: [] }]
  );
  const [connectionRows, setConnectionRows] = useState<ConnectionRowState[]>(
    () => buildConnectionRows(connectedStations, initialData?.connections)
  );
  const [submitting, setSubmitting] = useState(false);

  // 行ごとに connectedStations を線形探索しないための索引
  const stationById = useMemo(
    () => new Map(connectedStations.map((s) => [s.id, s])),
    [connectedStations]
  );

  function addCell() {
    setCells((prev) => [...prev, { xPositionMeters: '', facilities: [] }]);
  }

  function removeCell(cellIndex: number) {
    setCells((prev) => prev.filter((_, i) => i !== cellIndex));
  }

  function updateCellXPositionMeters(cellIndex: number, value: number | '') {
    setCells((prev) =>
      prev.map((cell, i) => (i === cellIndex ? { ...cell, xPositionMeters: value } : cell))
    );
  }

  function toggleFacilityType(cellIndex: number, typeCode: string) {
    setCells((prev) =>
      prev.map((cell, i) => {
        if (i !== cellIndex) return cell;
        const exists = cell.facilities.find((f) => f.typeCode === typeCode);
        if (exists) {
          return { ...cell, facilities: cell.facilities.filter((f) => f.typeCode !== typeCode) };
        }
        return {
          ...cell,
          facilities: [...cell.facilities, { typeCode, isWheelchairAccessible: true, isStrollerAccessible: true, notes: '' }],
        };
      })
    );
  }

  function updateFacility(
    cellIndex: number,
    typeCode: string,
    field: keyof Omit<FacilitySelection, 'typeCode'>,
    value: boolean | string
  ) {
    setCells((prev) =>
      prev.map((cell, i) => {
        if (i !== cellIndex) return cell;
        return {
          ...cell,
          facilities: cell.facilities.map((f) =>
            f.typeCode === typeCode ? { ...f, [field]: value } : f
          ),
        };
      })
    );
  }

  function updateConnectionRow(index: number, updates: Partial<ConnectionRowState>) {
    setConnectionRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cells.length === 0) {
      alert('アクセス点を1つ以上追加してください');
      return;
    }
    if (cells.some((cell) => cell.facilities.length === 0)) {
      alert('各アクセス点に設備タイプを1つ以上選択してください');
      return;
    }
    if (connectionRows.some((r) => r.checked && r.connectedPlatformId
      && typeof r.xRangeStart === 'number' && typeof r.xRangeEnd === 'number'
      && r.xRangeStart >= r.xRangeEnd)) {
      alert('対面乗り換え帯は開始位置が終了位置より小さい値である必要があります');
      return;
    }
    setSubmitting(true);

    const payload = {
      platformId,
      exits: exits || null,
      notes: notes || null,
      cells: cells.map((cell) => ({
        xPositionMeters: typeof cell.xPositionMeters === 'number' ? cell.xPositionMeters : null,
        facilities: cell.facilities.map((f) => ({
          typeCode: f.typeCode,
          isWheelchairAccessible: f.isWheelchairAccessible,
          isStrollerAccessible: f.isStrollerAccessible,
          notes: f.notes || null,
        })),
      })),
      connections: connectionRows.filter((r) => r.checked).map((r) => ({
        stationId: r.stationId,
        connectedPlatformId: r.connectedPlatformId || null,
        directionId: r.directionId || null,
        exitLabel: r.notes || null,
        xRangeStart: typeof r.xRangeStart === 'number' ? r.xRangeStart : null,
        xRangeEnd: typeof r.xRangeEnd === 'number' ? r.xRangeEnd : null,
      })),
    };

    const url = isEdit
      ? `/api/stations/${stationId}/platform-locations/${initialData!.id}`
      : `/api/stations/${stationId}/platform-locations`;
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
      alert('保存に失敗しました');
    }
  }

  const selectedPlatform = platforms.find((p) => p.id === platformId);
  const selectedPlatformLength = selectedPlatform ? Number(selectedPlatform.physicalLength) : null;
  const platformLengthLabel = selectedPlatformLength && selectedPlatformLength > 0
    ? `ホーム長: ${selectedPlatformLength.toFixed(2)} m`
    : 'ホーム長: 未入力';

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <NativeSelect
          label="ホーム"
          description={platformId ? platformLengthLabel : undefined}
          data={[
            { value: '', label: 'ホームを選択' },
            ...platforms.map((p) => ({ value: p.id, label: `${p.platformNumber}番ホーム` })),
          ]}
          value={platformId}
          onChange={(e) => setPlatformId(e.target.value)}
          required
        />

        <TextInput
          label="出口"
          description="この場所に繋がる出口を記載してください"
          placeholder="例: A3出口・B1出口"
          value={exits}
          onChange={(e) => setExits(e.target.value)}
        />

        <Textarea
          label="場所メモ"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>アクセス点</Text>
            <Button type="button" variant="subtle" size="compact-sm" onClick={addCell}>
              + アクセス点を追加
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mb="sm">
            ホーム上の設備位置（ホーム端からのメートル距離）ごとにアクセス点を登録してください
          </Text>
          {cells.length === 0 && (
            <Text size="sm" c="red" mt="xs">アクセス点を1つ以上追加してください</Text>
          )}
          <Stack gap="sm">
            {cells.map((cell, cellIndex) => (
              <Card key={cellIndex} withBorder padding="md">
                <Group justify="space-between" mb="sm">
                  <Title order={5}>アクセス点 {cellIndex + 1}</Title>
                  {cells.length > 1 && (
                    <Button
                      type="button"
                      variant="subtle"
                      color="red"
                      size="compact-sm"
                      onClick={() => removeCell(cellIndex)}
                    >
                      削除
                    </Button>
                  )}
                </Group>

                <NumberInput
                  label="ホーム端からの距離"
                  description={
                    selectedPlatformLength && selectedPlatformLength > 0
                      ? `ホーム端（x=0）からの距離。${platformLengthLabel}。範囲外（負の値やホーム長を超える値）も入力できます。空欄でホーム全体。`
                      : 'ホーム端（x=0）からの距離。負の値やホーム長を超える値も入力できます。空欄でホーム全体。'
                  }
                  step={0.1}
                  decimalScale={2}
                  placeholder="例: 42.5"
                  value={cell.xPositionMeters}
                  onChange={(v) => updateCellXPositionMeters(cellIndex, typeof v === 'number' ? v : '')}
                  suffix=" m"
                  w={160}
                  mb="sm"
                />

                <Text size="sm" fw={500} mb="xs">設備タイプ</Text>
                <Stack gap="xs">
                  {facilityTypes.map((ft) => {
                    const selected = cell.facilities.find((f) => f.typeCode === ft.code);
                    return (
                      <Card key={ft.code} withBorder padding="sm">
                        <Checkbox
                          label={ft.name}
                          checked={!!selected}
                          onChange={() => toggleFacilityType(cellIndex, ft.code)}
                          fw={500}
                        />
                        <Collapse in={!!selected}>
                          <Stack gap="xs" mt="sm" ml="xl">
                            <Group gap="lg">
                              <Checkbox
                                label="車いす対応"
                                checked={selected?.isWheelchairAccessible ?? false}
                                onChange={(e) => updateFacility(cellIndex, ft.code, 'isWheelchairAccessible', e.currentTarget.checked)}
                                size="sm"
                              />
                              <Checkbox
                                label="ベビーカー対応"
                                checked={selected?.isStrollerAccessible ?? false}
                                onChange={(e) => updateFacility(cellIndex, ft.code, 'isStrollerAccessible', e.currentTarget.checked)}
                                size="sm"
                              />
                            </Group>
                            <TextInput
                              placeholder="設備メモ（任意）"
                              value={selected?.notes ?? ''}
                              onChange={(e) => updateFacility(cellIndex, ft.code, 'notes', e.target.value)}
                              size="sm"
                            />
                          </Stack>
                        </Collapse>
                      </Card>
                    );
                  })}
                </Stack>
                {cell.facilities.length === 0 && (
                  <Text size="sm" c="red" mt="xs">設備タイプを1つ以上選択してください</Text>
                )}
              </Card>
            ))}
          </Stack>
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">乗換可能な駅</Text>
          <Text size="xs" c="dimmed" mb="xs">
            この場所を経由して乗り換え可能な駅にチェックを入れてください
          </Text>
          {connectionRows.length === 0 && (
            <Text size="sm" c="dimmed" fs="italic">接続可能な駅がありません</Text>
          )}
          <Stack gap={0} bg="white" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-sm)' }}>
            {connectionRows.map((row, i) => {
              const station = stationById.get(row.stationId);
              const stationPlatforms = station?.platforms ?? [];
              const stationDirections = station?.directions ?? [];
              const lineLabel = station && station.lines.length > 0
                ? station.lines.map((l) => l.name).join(' / ')
                : '(路線不明)';
              const stationLabel = station ? station.name : row.stationId;
              return (
                <div
                  key={row.stationId}
                  style={{
                    borderBottom: i < connectionRows.length - 1 ? '1px solid var(--mantine-color-gray-3)' : undefined,
                    padding: '10px 14px',
                    opacity: row.checked ? 1 : 0.5,
                  }}
                >
                  <Group gap="sm" align="flex-start">
                    <Checkbox
                      checked={row.checked}
                      onChange={(e) => updateConnectionRow(i, { checked: e.currentTarget.checked })}
                      mt={2}
                    />
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <div>
                        <Text size="sm" fw={500}>{lineLabel}</Text>
                        <Text size="xs" c="dimmed">{stationLabel}</Text>
                      </div>
                      <Group gap="xs" grow>
                        <NativeSelect
                          data={[
                            { value: '', label: 'ホームを選択（任意）' },
                            ...stationPlatforms.map((p) => ({
                              value: p.id,
                              label: `${p.platformNumber}番ホーム`,
                            })),
                          ]}
                          value={row.connectedPlatformId ?? ''}
                          onChange={(e) => updateConnectionRow(i, { connectedPlatformId: e.target.value || null })}
                          disabled={!row.checked}
                          size="xs"
                        />
                        <NativeSelect
                          data={[
                            { value: '', label: '方面を選択（任意）' },
                            ...stationDirections.map((d) => ({
                              value: d.id,
                              label: d.displayName,
                            })),
                          ]}
                          value={row.directionId ?? ''}
                          onChange={(e) => updateConnectionRow(i, { directionId: e.target.value || null })}
                          disabled={!row.checked}
                          size="xs"
                        />
                      </Group>
                      <TextInput
                        placeholder="備考（任意）"
                        value={row.notes}
                        onChange={(e) => updateConnectionRow(i, { notes: e.target.value })}
                        disabled={!row.checked}
                        size="xs"
                      />
                      {row.connectedPlatformId && (
                        <Group gap="xs" grow>
                          <NumberInput
                            label="対面乗り換え帯 開始"
                            description={`自ホーム座標系（ホーム端=0）での範囲。${platformLengthLabel}`}
                            step={0.1}
                            decimalScale={2}
                            value={row.xRangeStart}
                            onChange={(v) => updateConnectionRow(i, { xRangeStart: typeof v === 'number' ? v : '' })}
                            disabled={!row.checked}
                            suffix=" m"
                            size="xs"
                          />
                          <NumberInput
                            label="対面乗り換え帯 終了"
                            step={0.1}
                            decimalScale={2}
                            value={row.xRangeEnd}
                            onChange={(v) => updateConnectionRow(i, { xRangeEnd: typeof v === 'number' ? v : '' })}
                            disabled={!row.checked}
                            suffix=" m"
                            size="xs"
                          />
                        </Group>
                      )}
                    </Stack>
                  </Group>
                </div>
              );
            })}
          </Stack>
        </div>

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '登録'}
          </Button>
          <Button type="button" variant="default" onClick={() => router.push(`/stations/${stationId}/facilities`)}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
