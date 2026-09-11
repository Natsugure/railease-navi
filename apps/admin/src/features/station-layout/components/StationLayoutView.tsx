import { Badge, Group, Stack, Text, Title } from '@mantine/core';
import {
  connectionLabels, exitsLabel, hasDisplayableInfo, isDrawable,
} from '@furatora/platform-diagram/domain';
import { LinkAnchor } from '@/components/LinkElements';
import type { StationLayoutContext, LayoutConcourseDTO } from '@/features/station-layout/ports';
import { StationLayoutEditor } from './StationLayoutEditor';

type Props = {
  stationId: string;
  context: StationLayoutContext;
};

/**
 * 駅レイアウト統合ページの本体。Server Component。
 *
 * タブ・図・編集レイヤ・未保存パネルはすべて StationLayoutEditor（Client
 * Component）に委譲する（未保存確認モーダルがタブ遷移をまたいで単一のdirty
 * stateを共有する必要があるため）。ここに残すのは静的表示のみ:
 * 戻るリンク・駅名・「位置未登録の設備・乗換」セクション・notes。
 *
 * 「位置未登録の設備・乗換」セクションと notes は、図を描けない場合
 * （ホーム長0・停車パターン無し）も出す。座標未入力のデータを見つけるための
 * セクションなので、図と一緒に隠すと目的を損なう（web の PlatformDisplay と同じ構成）。
 */
export function StationLayoutView({ stationId, context }: Props) {
  const { platform } = context;

  return (
    <div>
      <LinkAnchor href="/stations" size="sm" mb="lg" style={{ display: 'block' }}>
        &larr; 駅一覧に戻る
      </LinkAnchor>

      <Title order={2} mb="lg">{context.stationName}</Title>

      {!platform ? (
        <Text c="dimmed">ホームがまだ登録されていません。</Text>
      ) : (
        <Stack gap="lg">
          <StationLayoutEditor stationId={stationId} platforms={context.platforms} platform={platform} />
          <UndrawableSection concourses={platform.concourses} />
          {platform.notes && (
            <Text size="sm" c="yellow.8" bg="yellow.0" p="sm" style={{ borderRadius: 8 }}>
              {platform.notes}
            </Text>
          )}
        </Stack>
      )}
    </div>
  );
}

/**
 * 座標を持たないコンコース（束ね線を引けず図に描けないもの）の一覧。
 * PR3では読み取り専用（「位置を入力」導線はPR4の#51見える化で追加する）。
 */
function UndrawableSection({ concourses }: { concourses: LayoutConcourseDTO[] }) {
  const undrawable = concourses.filter((c) => !isDrawable(c) && hasDisplayableInfo(c));
  if (undrawable.length === 0) return null;

  return (
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
  );
}
