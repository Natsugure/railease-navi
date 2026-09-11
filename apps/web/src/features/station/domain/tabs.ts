import type { DirectionTabDTO, PlatformDTO } from '@furatora/platform-diagram/domain';

/**
 * ホーム一覧を方面タブへ組み立てる（純関数・DB非依存）。
 * ホームは inbound/outbound の両方面IDに登録されうる（重複はしない）。
 * どちらの方面IDも持たないホームは「全方面」タブへまとめる。
 */
export function buildDirectionTabs(platforms: PlatformDTO[]): DirectionTabDTO[] {
  const directionToPlatforms = new Map<string, PlatformDTO[]>();
  const directionNames = new Map<string, string>();

  for (const platform of platforms) {
    const directions: [string | null, string | null][] = [
      [platform.inboundDirectionId, platform.inboundDirectionName],
      [platform.outboundDirectionId, platform.outboundDirectionName],
    ];

    for (const [directionId, directionName] of directions) {
      if (directionId === null) continue;
      if (!directionNames.has(directionId)) {
        directionNames.set(directionId, directionName ?? '方面');
      }
      const existing = directionToPlatforms.get(directionId) ?? [];
      if (!existing.some((p) => p.id === platform.id)) {
        directionToPlatforms.set(directionId, [...existing, platform]);
      }
    }
  }

  const noDirectionPlatforms = platforms.filter(
    (p) => p.inboundDirectionId === null && p.outboundDirectionId === null,
  );

  return [
    ...[...directionToPlatforms.entries()].map(([directionId, dirPlatforms]) => ({
      directionId,
      directionName: directionNames.get(directionId) ?? '方面',
      platforms: dirPlatforms,
    })),
    ...(noDirectionPlatforms.length > 0
      ? [{ directionId: null, directionName: '全方面', platforms: noDirectionPlatforms }]
      : []),
  ];
}
