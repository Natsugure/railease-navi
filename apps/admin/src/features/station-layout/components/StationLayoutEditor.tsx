'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Badge, Button, Card, ColorSwatch, Group, Modal, Stack, Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  computeBounds, layoutConcoursePlates, layoutFacingBanners, exitsLabel, connectionLabels,
} from '@furatora/platform-diagram/domain';
import { PlatformDiagram } from '@furatora/platform-diagram/components';
import { describeError } from '@/features/station-publishing/describeError';
import type { LayoutPlatformDetailDTO, LayoutConcourseDTO, LayoutStopPatternDTO } from '@/features/station-layout/ports';
import {
  createConcourseDraft, createPatternDraft, moveCell, moveCarBoundary, moveCarEdge,
  isConcourseDirty, isPatternDirty, toPlatformLocationPayload, toStopPatternPayload,
  type ConcourseDraft, type PatternDraft,
} from '@/features/station-layout/domain/editDraft';
import { DiagramEditLayer } from './DiagramEditLayer';

type Props = {
  stationId: string;
  platforms: { id: string; platformNumber: string }[];
  platform: LayoutPlatformDetailDTO;
};

function layoutHref(stationId: string, platformId: string, patternId?: string) {
  const params = new URLSearchParams({ platformId });
  if (patternId) params.set('patternId', patternId);
  return `/stations/${stationId}/layout?${params.toString()}`;
}

function mergeConcourse(baseline: LayoutConcourseDTO, draft: ConcourseDraft | undefined): LayoutConcourseDTO {
  if (!draft) return baseline;
  const byId = new Map(draft.cells.map((c) => [c.id, c.xPositionMeters]));
  return {
    ...baseline,
    cells: baseline.cells.map((cell) => (
      byId.has(cell.id) ? { ...cell, xPositionMeters: byId.get(cell.id)! } : cell
    )),
  };
}

function mergePattern(baseline: LayoutStopPatternDTO, draft: PatternDraft | undefined): LayoutStopPatternDTO {
  if (!draft) return baseline;
  const byNumber = new Map(draft.cars.map((c) => [c.carNumber, c]));
  return {
    ...baseline,
    cars: baseline.cars.map((car) => {
      const d = byNumber.get(car.carNumber);
      return d ? { ...car, startMeters: d.startMeters, endMeters: d.endMeters } : car;
    }),
  };
}

/**
 * 駅レイアウトページの編集ビュー本体（Client Component）。図・編集レイヤ・
 * 未保存パネルを1つのツリーにまとめる（ADR-0010 決定2）。DTOはpropsで受け取り、
 * 関数propsは渡さない。
 *
 * bounds凍結（design.md「編集レイヤの座標変換」）: computeBounds は
 * concourseBaselines/patternBaselines（保存が確定した値。ドラッグ中のdraftは
 * 含まない）からのみ算出する。これらのuseStateはマウント時と保存成功時にしか
 * 置き換わらないため、ドラッグ中は自動的に再計算されない。保存成功時は
 * サーバーへ実際に送った値をそのままbaselineへ取り込む（router.refresh()の
 * 到着を待たない）。cellのidはPUTがコンコース全体を全置換するたびに
 * サーバー側で再生成されるが、そのidはAPIへの送信にもUIのキーにも使うだけで
 * 保存結果の正しさには影響しない（xPositionMetersの値そのものが真実）。
 */
export function StationLayoutEditor({ stationId, platforms, platform }: Props) {
  const router = useRouter();

  const [concourseBaselines, setConcourseBaselines] = useState(platform.concourses);
  const [patternBaselines, setPatternBaselines] = useState(platform.stopPatterns);
  const [concourseDrafts, setConcourseDrafts] = useState<Map<string, ConcourseDraft>>(new Map());
  const [patternDrafts, setPatternDrafts] = useState<Map<string, PatternDraft>>(new Map());
  const [savingConcourseIds, setSavingConcourseIds] = useState<Set<string>>(new Set());
  const [savingPatternIds, setSavingPatternIds] = useState<Set<string>>(new Set());
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [confirmOpened, setConfirmOpened] = useState(false);

  const selectedPatternBaseline = patternBaselines.find((p) => p.patternId === platform.selectedPatternId) ?? null;

  const dirtyConcourseIds = useMemo(
    () => concourseBaselines
      .filter((c) => isConcourseDirty(c, concourseDrafts.get(c.id) ?? createConcourseDraft(c)))
      .map((c) => c.id),
    [concourseBaselines, concourseDrafts],
  );
  const dirtyPatternIds = useMemo(
    () => patternBaselines
      .filter((p) => isPatternDirty(p, patternDrafts.get(p.patternId) ?? createPatternDraft(p)))
      .map((p) => p.patternId),
    [patternBaselines, patternDrafts],
  );
  const isAnyDirty = dirtyConcourseIds.length > 0 || dirtyPatternIds.length > 0;

  // 未保存のままタブ遷移・ページ離脱するとaddEventListenerでも止めきれない経路が残る
  // （AdminShellのナビ等。App Routerに公式のルート遷移ブロックが無いため）。
  // ここで止められるのはリロード・タブ閉じ・このコンポーネントが持つタブのみ
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!isAnyDirty) return;
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isAnyDirty]);

  // 凍結bounds: concourseBaselines/patternBaselinesが変わったとき（マウント時・
  // 保存成功時）だけ再計算される。ドラッグ中のdraftはここに含めない
  const bounds = useMemo(
    () => computeBounds(platform.physicalLength, patternBaselines, concourseBaselines),
    [platform.physicalLength, patternBaselines, concourseBaselines],
  );

  // 表示用（draft込み）のコンコース。束ね線・プレートがドラッグに追従するよう
  // 毎レンダー再計算する（bounds自体は凍結済みなのでスケールし直さない）
  const displayConcourses = useMemo(
    () => concourseBaselines.map((c) => mergeConcourse(c, concourseDrafts.get(c.id))),
    [concourseBaselines, concourseDrafts],
  );
  const displayPattern = selectedPatternBaseline
    ? mergePattern(selectedPatternBaseline, patternDrafts.get(selectedPatternBaseline.patternId))
    : null;

  const plateLayout = useMemo(() => layoutConcoursePlates(displayConcourses, bounds), [displayConcourses, bounds]);
  const facingLayout = useMemo(() => layoutFacingBanners(displayConcourses, bounds), [displayConcourses, bounds]);

  const cellToConcourseId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of concourseBaselines) for (const cell of c.cells) map.set(cell.id, c.id);
    return map;
  }, [concourseBaselines]);

  function updateConcourseDraft(concourseId: string, mutate: (draft: ConcourseDraft) => ConcourseDraft) {
    setConcourseDrafts((prev) => {
      const baseline = concourseBaselines.find((c) => c.id === concourseId);
      if (!baseline) return prev;
      const next = new Map(prev);
      const current = next.get(concourseId) ?? createConcourseDraft(baseline);
      next.set(concourseId, mutate(current));
      return next;
    });
  }

  function updatePatternDraft(patternId: string, mutate: (draft: PatternDraft) => PatternDraft) {
    setPatternDrafts((prev) => {
      const baseline = patternBaselines.find((p) => p.patternId === patternId);
      if (!baseline) return prev;
      const next = new Map(prev);
      const current = next.get(patternId) ?? createPatternDraft(baseline);
      next.set(patternId, mutate(current));
      return next;
    });
  }

  function handleMoveCell(cellId: string, x: number) {
    const concourseId = cellToConcourseId.get(cellId);
    if (!concourseId) return;
    updateConcourseDraft(concourseId, (draft) => moveCell(draft, cellId, x));
  }

  function handleMoveCarBoundary(boundaryIndex: number, x: number) {
    if (!selectedPatternBaseline) return;
    updatePatternDraft(
      selectedPatternBaseline.patternId,
      (draft) => moveCarBoundary(draft, boundaryIndex, x, { minCarMeters: 0.5 }),
    );
  }

  function handleMoveCarEdge(edge: { carNumber: number; side: 'start' | 'end' }, x: number) {
    if (!selectedPatternBaseline) return;
    updatePatternDraft(
      selectedPatternBaseline.patternId,
      (draft) => moveCarEdge(draft, edge, x, { minCarMeters: 0.5 }),
    );
  }

  async function saveConcourse(concourse: LayoutConcourseDTO) {
    const draft = concourseDrafts.get(concourse.id);
    if (!draft) return;
    setSavingConcourseIds((prev) => new Set(prev).add(concourse.id));
    try {
      const payload = toPlatformLocationPayload(platform.id, concourse, draft);
      const res = await fetch(`/api/stations/${stationId}/platform-locations/${concourse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        notifications.show({ title: '保存に失敗しました', message: describeError(body), color: 'red' });
        return;
      }
      const label = exitsLabel(concourse) ?? connectionLabels(concourse)[0] ?? 'コンコース';
      setConcourseBaselines((prev) => prev.map((c) => (c.id === concourse.id ? mergeConcourse(c, draft) : c)));
      setConcourseDrafts((prev) => {
        const next = new Map(prev);
        next.delete(concourse.id);
        return next;
      });
      notifications.show({ title: '保存しました', message: `${label} の位置を保存しました`, color: 'green' });
      router.refresh();
    } finally {
      setSavingConcourseIds((prev) => {
        const next = new Set(prev);
        next.delete(concourse.id);
        return next;
      });
    }
  }

  async function savePattern(pattern: LayoutStopPatternDTO) {
    const draft = patternDrafts.get(pattern.patternId);
    if (!draft) return;
    setSavingPatternIds((prev) => new Set(prev).add(pattern.patternId));
    try {
      const payload = toStopPatternPayload(platform.id, pattern, draft);
      const res = await fetch(`/api/stations/${stationId}/train-stop-patterns/${pattern.patternId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        notifications.show({ title: '保存に失敗しました', message: describeError(body), color: 'red' });
        return;
      }
      setPatternBaselines((prev) => prev.map((p) => (p.patternId === pattern.patternId ? mergePattern(p, draft) : p)));
      setPatternDrafts((prev) => {
        const next = new Map(prev);
        next.delete(pattern.patternId);
        return next;
      });
      notifications.show({ title: '保存しました', message: `${pattern.trainLabel} の停車位置を保存しました`, color: 'green' });
      router.refresh();
    } finally {
      setSavingPatternIds((prev) => {
        const next = new Set(prev);
        next.delete(pattern.patternId);
        return next;
      });
    }
  }

  function handleTabClick(e: React.MouseEvent, href: string) {
    if (!isAnyDirty) return; // 未保存が無ければ通常のLinkナビゲーションに任せる
    e.preventDefault();
    setPendingHref(href);
    setConfirmOpened(true);
  }

  function confirmDiscardAndNavigate() {
    setConfirmOpened(false);
    if (pendingHref) router.push(pendingHref);
    setPendingHref(null);
  }

  return (
    <Stack gap="lg">
      <Group gap="xs">
        {platforms.map((p) => (
          <Button
            key={p.id}
            component={Link}
            href={layoutHref(stationId, p.id)}
            variant={p.id === platform.id ? 'filled' : 'default'}
            size="sm"
            onClick={(e: React.MouseEvent) => handleTabClick(e, layoutHref(stationId, p.id))}
          >
            {p.platformNumber}番線
          </Button>
        ))}
      </Group>

      <Card withBorder padding="lg">
        <Group gap="xs" mb="md">
          {platform.lineColor && <ColorSwatch color={platform.lineColor} size={12} />}
          <Text fw={600}>{platform.lineName}</Text>
          {(platform.inboundDirectionName || platform.outboundDirectionName) && (
            <Text size="sm" c="dimmed">
              {[platform.inboundDirectionName, platform.outboundDirectionName].filter(Boolean).join(' / ')}
            </Text>
          )}
          <Text size="sm" c="dimmed">
            {platform.physicalLength > 0 ? `ホーム長 ${platform.physicalLength}m` : 'ホーム長未入力'}
          </Text>
        </Group>

        {patternBaselines.length > 1 && (
          <Group gap="xs" mb="md">
            {patternBaselines.map((sp) => (
              <Button
                key={sp.patternId}
                component={Link}
                href={layoutHref(stationId, platform.id, sp.patternId)}
                variant={sp.patternId === platform.selectedPatternId ? 'filled' : 'default'}
                size="compact-sm"
                onClick={(e: React.MouseEvent) => handleTabClick(e, layoutHref(stationId, platform.id, sp.patternId))}
              >
                {sp.trainLabel}
                {dirtyPatternIds.includes(sp.patternId) && ' ●'}
              </Button>
            ))}
          </Group>
        )}

        {platform.physicalLength === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            ホーム長が未登録のため図を表示できません
          </Text>
        ) : !displayPattern ? (
          <Text size="sm" c="dimmed" fs="italic">列車情報がありません</Text>
        ) : (
          // min-w-0 は必須。無いと図のキャンバス幅まで膨らみ overflow-x-auto が効かない
          <div className="min-w-0">
            <PlatformDiagram
              pattern={displayPattern}
              physicalLength={platform.physicalLength}
              concourses={displayConcourses}
              platformSide={platform.platformSide}
              bounds={bounds}
              plateLayout={plateLayout}
              facingLayout={facingLayout}
              diagramOverlay={(rows) => (
                <DiagramEditLayer
                  rows={rows}
                  bounds={bounds}
                  physicalLength={platform.physicalLength}
                  cars={displayPattern.cars}
                  cellHandles={displayConcourses
                    .flatMap((c) => c.cells)
                    .filter((c) => c.xPositionMeters !== null)
                    .map((c) => ({ id: c.id, xPositionMeters: c.xPositionMeters as number }))}
                  selectedCellId={selectedCellId}
                  onSelectCell={setSelectedCellId}
                  onMoveCell={handleMoveCell}
                  onMoveCarBoundary={handleMoveCarBoundary}
                  onMoveCarEdge={handleMoveCarEdge}
                />
              )}
            />
          </div>
        )}
      </Card>

      {/* 未保存の編集パネル。「すべて保存」は作らない
          （複数アグリゲートの逐次保存は原子的でなく、誤った保証になる） */}
      {(dirtyConcourseIds.length > 0 || dirtyPatternIds.length > 0) && (
        <Card withBorder padding="md">
          <Text size="sm" fw={600} mb="xs">未保存の変更</Text>
          <Stack gap="xs">
            {concourseBaselines.filter((c) => dirtyConcourseIds.includes(c.id)).map((c) => (
              <Group key={c.id} justify="space-between">
                <Group gap="xs">
                  <Badge color="orange" size="sm">●</Badge>
                  <Text size="sm">{exitsLabel(c) ?? connectionLabels(c)[0] ?? 'コンコース'}</Text>
                </Group>
                <Button
                  size="compact-sm"
                  loading={savingConcourseIds.has(c.id)}
                  onClick={() => saveConcourse(c)}
                >
                  保存
                </Button>
              </Group>
            ))}
            {patternBaselines.filter((p) => dirtyPatternIds.includes(p.patternId)).map((p) => (
              <Group key={p.patternId} justify="space-between">
                <Group gap="xs">
                  <Badge color="orange" size="sm">●</Badge>
                  <Text size="sm">{p.trainLabel} の停車位置</Text>
                </Group>
                <Button
                  size="compact-sm"
                  loading={savingPatternIds.has(p.patternId)}
                  onClick={() => savePattern(p)}
                >
                  保存
                </Button>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <Modal opened={confirmOpened} onClose={() => setConfirmOpened(false)} title="未保存の変更があります" centered>
        <Text mb="lg">保存していない変更は失われます。移動しますか？</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmOpened(false)}>キャンセル</Button>
          <Button color="red" onClick={confirmDiscardAndNavigate}>変更を破棄して移動</Button>
        </Group>
      </Modal>
    </Stack>
  );
}
