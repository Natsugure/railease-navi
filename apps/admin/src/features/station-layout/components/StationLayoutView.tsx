import {
  Badge, Card, ColorSwatch, Group, Stack, Text, Title,
} from '@mantine/core';
import {
  computeBounds,
  layoutConcoursePlates,
  layoutFacingBanners,
  connectionLabels,
  exitsLabel,
  hasDisplayableInfo,
  type ConcourseDTO,
} from '@furatora/platform-diagram/domain';
import { PlatformDiagram } from '@furatora/platform-diagram/components';
import { LinkAnchor, LinkButton } from '@/components/LinkElements';
import type { StationLayoutContext } from '@/features/station-layout/ports';

type Props = {
  stationId: string;
  context: StationLayoutContext;
};

// 図に描けるコンコースか。座標を持つアクセス点が1つでもあれば束ね線を引ける
// （apps/web/src/features/platform/components/PlatformDisplay.tsx と同じ判定）
function isDrawable(concourse: ConcourseDTO): boolean {
  return concourse.cells.some((cell) => cell.xPositionMeters !== null);
}

function layoutHref(stationId: string, platformId: string, patternId?: string) {
  const params = new URLSearchParams({ platformId });
  if (patternId) params.set('patternId', patternId);
  return `/stations/${stationId}/layout?${params.toString()}`;
}

// 駅レイアウト統合ページの本体（読み取り専用、Issue #95 PR2）。Server Component のまま
// （PlatformDiagram はイベントハンドラを持たないため RSC で描画できる）。
// ホームタブ・パターンタブは router.push ではなく Link で組む。PR2 はページ全体が
// Server Component のままで完結するため、未保存確認が要らずクライアントJSゼロで済む
// （router.push 化は PR3 の編集ビューで未保存stateの確認が必要になった時点で行う）。
export function StationLayoutView({ stationId, context }: Props) {
  const { platform } = context;

  return (
    <div>
      <LinkAnchor href="/stations" size="sm" mb="lg" style={{ display: 'block' }}>
        &larr; 駅一覧に戻る
      </LinkAnchor>

      <Title order={2} mb="lg">{context.stationName}</Title>

      {context.platforms.length === 0 || !platform ? (
        <Text c="dimmed">ホームがまだ登録されていません。</Text>
      ) : (
        <Stack gap="lg">
          {/* ホームタブ */}
          <Group gap="xs">
            {context.platforms.map((p) => (
              <LinkButton
                key={p.id}
                href={layoutHref(stationId, p.id)}
                variant={p.id === platform.id ? 'filled' : 'default'}
                size="sm"
              >
                {p.platformNumber}番線
              </LinkButton>
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

            {/* 停車位置パターンタブ */}
            {platform.stopPatterns.length > 1 && (
              <Group gap="xs" mb="md">
                {platform.stopPatterns.map((sp) => (
                  <LinkButton
                    key={sp.patternId}
                    href={layoutHref(stationId, platform.id, sp.patternId)}
                    variant={sp.patternId === platform.selectedPatternId ? 'filled' : 'default'}
                    size="compact-sm"
                  >
                    {sp.trainLabel}
                  </LinkButton>
                ))}
              </Group>
            )}

            <StationLayoutDiagram platform={platform} />
          </Card>
        </Stack>
      )}
    </div>
  );
}

function StationLayoutDiagram({ platform }: { platform: NonNullable<StationLayoutContext['platform']> }) {
  if (platform.physicalLength === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        ホーム長が未登録のため図を表示できません
      </Text>
    );
  }

  const selectedPattern = platform.stopPatterns.find((sp) => sp.patternId === platform.selectedPatternId);
  if (!selectedPattern) {
    return <Text size="sm" c="dimmed" fs="italic">列車情報がありません</Text>;
  }

  // bounds は「全パターン」から算出する。選択中の1本だけから算出すると、パターンを
  // 切り替えるたびに図がスケールし直してしまう（PR3の bounds凍結と地続きの理由）
  const bounds = computeBounds(platform.physicalLength, platform.stopPatterns, platform.concourses);
  const plateLayout = layoutConcoursePlates(platform.concourses, bounds);
  const facingLayout = layoutFacingBanners(platform.concourses, bounds);

  // 図に描けない（座標を持つアクセス点が無い）コンコースだけをテキストで補う
  const undrawable = platform.concourses.filter((c) => !isDrawable(c) && hasDisplayableInfo(c));

  return (
    <Stack gap="md">
      {/* min-w-0 は必須。無いと図のキャンバス（min-width指定）まで幅が膨らみ、
          overflow-x-auto が効かず切り落とされる（PlatformDisplay.tsx と同じ注意点） */}
      <div className="min-w-0">
        <PlatformDiagram
          pattern={selectedPattern}
          physicalLength={platform.physicalLength}
          concourses={platform.concourses}
          platformSide={platform.platformSide}
          bounds={bounds}
          plateLayout={plateLayout}
          facingLayout={facingLayout}
        />
      </div>

      {undrawable.length > 0 && (
        <div>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
            位置未登録の設備・乗換
          </Text>
          <Text size="xs" c="dimmed" mb="xs">
            ホーム上の位置が登録されていないため、図には表示していません。
          </Text>
          <Stack gap="xs">
            {undrawable.map((concourse) => {
              const exits = exitsLabel(concourse);
              const connections = connectionLabels(concourse);
              const facilityNames = [
                ...new Set(concourse.cells.flatMap((cell) => cell.facilities.map((f) => f.typeName))),
              ];
              return (
                <div key={concourse.id}>
                  {exits && <Text size="sm" fw={500}>{exits}</Text>}
                  {connections.length > 0 && (
                    <Text size="sm" c="dimmed">乗換: {connections.join('・')}</Text>
                  )}
                  {facilityNames.length > 0 && (
                    <Group gap={6} mt={2}>
                      {facilityNames.map((name) => (
                        <Badge key={name} variant="light" color="gray" size="sm">{name}</Badge>
                      ))}
                    </Group>
                  )}
                </div>
              );
            })}
          </Stack>
        </div>
      )}

      {platform.notes && (
        <Text size="sm" c="yellow.8" bg="yellow.0" p="sm" style={{ borderRadius: 8 }}>
          {platform.notes}
        </Text>
      )}
    </Stack>
  );
}
