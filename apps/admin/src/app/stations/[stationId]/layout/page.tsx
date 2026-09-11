import { notFound } from 'next/navigation';
import { parseUuidParam } from '@/shared/list/params';
import { StationLayoutView } from '@/features/station-layout/components/StationLayoutView';
import { stationLayoutPageQuery } from '@/di';

/** 駅レイアウト統合ページ（読み取り専用）。URL契約は docs/spec/design.md「URL契約」 */
export default async function StationLayoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ stationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { stationId } = await params;
  // パスの stationId は UUID でなければ 404。検証せずに渡すと Postgres の uuid 型エラーで 500 になる
  if (!parseUuidParam(stationId)) notFound();

  const raw = await searchParams;
  // 不正値は500にせず先頭にフォールバックさせる
  const platformId = parseUuidParam(raw.platformId);
  const patternId = parseUuidParam(raw.patternId);

  const context = await stationLayoutPageQuery.getContext(stationId, { platformId, patternId });
  if (!context) notFound();

  return <StationLayoutView stationId={stationId} context={context} />;
}
