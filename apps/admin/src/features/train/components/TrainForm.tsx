'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ActionIcon, Button, Checkbox, Group, MultiSelect, NativeSelect,
  NumberInput, Stack, Text, TextInput,
} from '@mantine/core';
import { Trash2 } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import type { OperatorOption, TrainLineOption } from '@/features/train/ports';

// @furatora/database/schema には carLength を含まないため、admin側でローカルに定義する
type CarStructureItem = { carNumber: number; doorCount: number; carLength: number | null };
type EquipmentItem = { carNumber: number; nearDoor: number; isStandard: boolean };

type TrainData = {
  id?: string;
  name: string;
  operatorId: string;
  lineIds: string[];
  carCount: number;
  carStructure: CarStructureItem[] | null;
  freeSpaces: EquipmentItem[] | null;
  prioritySeats: EquipmentItem[] | null;
};

type Props = {
  initialData?: TrainData;
  isEdit?: boolean;
  operators: OperatorOption[];
  lines: TrainLineOption[];
};

export function TrainForm({ initialData, isEdit = false, operators, lines }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name ?? '');
  const [operatorId, setOperatorId] = useState(initialData?.operatorId ?? '');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(initialData?.lineIds ?? []);
  const [carCount, setCarCount] = useState(initialData?.carCount ?? 10);

  const initCarStructures = (): CarStructureItem[] => {
    const cs = initialData?.carStructure;
    if (cs && cs.length > 0) return cs;
    const count = initialData?.carCount ?? 10;
    return Array.from({ length: count }, (_, i) => ({ carNumber: i + 1, doorCount: 4, carLength: null }));
  };
  const [carStructures, setCarStructures] = useState(initCarStructures);

  const [freeSpaces, setFreeSpaces] = useState<EquipmentItem[]>(initialData?.freeSpaces ?? []);
  const [prioritySeats, setPrioritySeats] = useState<EquipmentItem[]>(initialData?.prioritySeats ?? []);
  const [submitting, setSubmitting] = useState(false);

  function addFreeSpace() {
    setFreeSpaces((prev) => [...prev, { carNumber: 1, nearDoor: 1, isStandard: true }]);
  }
  function removeFreeSpace(index: number) {
    setFreeSpaces((prev) => prev.filter((_, i) => i !== index));
  }
  function updateFreeSpace(index: number, field: keyof EquipmentItem, value: number | string | boolean) {
    setFreeSpaces((prev) => prev.map((fs, i) => (i === index ? { ...fs, [field]: value } : fs)));
  }

  function addPrioritySeat() {
    setPrioritySeats((prev) => [...prev, { carNumber: 1, nearDoor: 1, isStandard: true }]);
  }
  function removePrioritySeat(index: number) {
    setPrioritySeats((prev) => prev.filter((_, i) => i !== index));
  }
  function updatePrioritySeat(index: number, field: keyof EquipmentItem, value: number | string | boolean) {
    setPrioritySeats((prev) => prev.map((ps, i) => (i === index ? { ...ps, [field]: value } : ps)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // NumberInputからの空文字列をチェック
    const hasInvalidFreeSpace = freeSpaces.some(
      fs => typeof fs.carNumber !== 'number' || typeof fs.nearDoor !== 'number'
    );
    const hasInvalidPrioritySeat = prioritySeats.some(
      ps => typeof ps.carNumber !== 'number' || typeof ps.nearDoor !== 'number'
    );

    if (hasInvalidFreeSpace || hasInvalidPrioritySeat) {
      notifications.show({
        title: '更新エラー',
        message: '入力項目が不足しています。',
        color: 'red',
        autoClose: 3000,
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      name,
      operatorId,
      lineIds: selectedLineIds,
      carCount,
      carStructure: carStructures.length > 0 ? carStructures : null,
      freeSpaces: freeSpaces.length > 0 ? freeSpaces : null,
      prioritySeats: prioritySeats.length > 0 ? prioritySeats : null,
    };

    const url = isEdit ? `/api/trains/${initialData!.id}` : '/api/trains';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push('/trains');
      router.refresh();
    } else {
      setSubmitting(false);
      alert('保存に失敗しました');
    }
  }

  const lineSelectData = lines.map((l) => ({ value: l.id, label: l.name }));

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <TextInput
          label="列車名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <NativeSelect
          label="事業者"
          data={[
            { value: '', label: '事業者を選択' },
            ...operators.map((op) => ({ value: op.id, label: op.name })),
          ]}
          value={operatorId}
          onChange={(e) => {
            setOperatorId(e.target.value);
            setSelectedLineIds([]);
          }}
          required
        />

        <MultiSelect
          label="路線"
          searchable
          data={lineSelectData}
          value={selectedLineIds}
          onChange={setSelectedLineIds}
        />

        <NumberInput
          label="両数"
          min={1}
          max={17}
          value={carCount}
          onChange={(v) => {
            const newCount = typeof v === 'number' ? v : 10;
            setCarCount(newCount);
            setCarStructures((prev) =>
              Array.from({ length: newCount }, (_, i) => ({
                carNumber: i + 1,
                doorCount: prev[i]?.doorCount ?? 4,
                carLength: prev[i]?.carLength ?? null,
              }))
            );
          }}
          required
          w={{ base: '100%', xs: 128 }}
        />

        <div>
          <Text size="sm" fw={500} mb="xs">車両構成（号車ごとのドア数・実長）</Text>
          <Text size="xs" c="dimmed" mb="xs">
            実長（メートル）は任意入力です。未指定の場合は停車位置パターンの自動算出で標準値（20.0m）を使用します。
          </Text>
          <Stack gap={4}>
            {carStructures.map((cs, i) => (
              <Group key={i} gap="sm" align="center">
                <Text size="sm" c="dimmed" w={56} ta="right">{cs.carNumber}号車</Text>
                <NumberInput
                  min={1}
                  max={6}
                  value={cs.doorCount}
                  onChange={(v) =>
                    setCarStructures((prev) =>
                      prev.map((c, j) => j === i ? { ...c, doorCount: typeof v === 'number' ? v : 4 } : c)
                    )
                  }
                  w={80}
                  size="xs"
                  suffix="ドア"
                />
                <NumberInput
                  min={0}
                  step={0.1}
                  decimalScale={2}
                  placeholder="20.0"
                  value={cs.carLength ?? ''}
                  onChange={(v) =>
                    setCarStructures((prev) =>
                      prev.map((c, j) => j === i ? { ...c, carLength: typeof v === 'number' ? v : null } : c)
                    )
                  }
                  w={100}
                  size="xs"
                  suffix=" m"
                />
              </Group>
            ))}
          </Stack>
        </div>

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>フリースペース</Text>
            <Button type="button" variant="subtle" size="compact-sm" onClick={addFreeSpace}>+ 追加</Button>
          </Group>
          <Stack gap="xs">
            {freeSpaces.map((fs, i) => (
              <Group key={i} gap="sm" align="center" wrap="wrap">
                <NumberInput label="号車" min={1} max={carCount} value={fs.carNumber}
                  onChange={(v) => updateFreeSpace(i, 'carNumber', v)}
                  w={80} size="xs"
                  error={typeof fs.carNumber === 'string' && fs.carNumber === ''}
                />
                <NumberInput label="ドア番号" min={1} value={fs.nearDoor}
                  onChange={(v) => updateFreeSpace(i, 'nearDoor', v)}
                  w={80} size="xs"
                  error={typeof fs.nearDoor === 'string' && fs.nearDoor === ''}
                />
                <Checkbox label="全編成装備" checked={fs.isStandard}
                  onChange={(e) => updateFreeSpace(i, 'isStandard', e.currentTarget.checked)}
                  size="sm" mt="lg"
                />
                <ActionIcon variant="filled" color="red" size="sm" onClick={() => removeFreeSpace(i)} mt="lg">
                  <Trash2 style={{ width: '70%', height: '70%' }}/>
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </div>

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>優先席</Text>
            <Button type="button" variant="subtle" size="compact-sm" onClick={addPrioritySeat}>+ 追加</Button>
          </Group>
          <Stack gap="xs">
            {prioritySeats.map((ps, i) => (
              <Group key={i} gap="sm" align="center" wrap="wrap">
                <NumberInput label="号車" min={1} max={carCount} value={ps.carNumber}
                  onChange={(v) => updatePrioritySeat(i, 'carNumber', v)}
                  w={80} size="xs"
                  error={typeof ps.carNumber === 'string' && ps.carNumber === ''}
                />
                <NumberInput label="ドア番号" min={1} value={ps.nearDoor}
                  onChange={(v) => updatePrioritySeat(i, 'nearDoor', v)}
                  w={80} size="xs"
                  error={typeof ps.nearDoor === 'string' && ps.nearDoor === ''}
                />
                <Checkbox label="全編成装備" checked={ps.isStandard}
                  onChange={(e) => updatePrioritySeat(i, 'isStandard', e.currentTarget.checked)}
                  size="sm" mt="lg"
                />
                <ActionIcon variant="filled" color="red" size="sm" onClick={() => removePrioritySeat(i)} mt="lg">
                  <Trash2 style={{ width: '70%', height: '70%' }}/>
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </div>

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '登録'}
          </Button>
          <Button type="button" variant="default" onClick={() => router.push('/trains')}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
