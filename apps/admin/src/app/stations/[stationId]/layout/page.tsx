import { notFound } from 'next/navigation';
import { parseUuidParam } from '@/shared/list/params';
import { StationLayoutView } from '@/features/station-layout/components/StationLayoutView';
import { stationLayoutPageQuery } from '@/di';

// 駅レイアウト統合ページ（Issue #95 PR2、読み取り専用）。
// stationLayoutPageQuery を1本だけ呼ぶ。旧 /facilities は5階層に分散していたが
// ここではホームタブ・ホーム基本情報・ホーム図・座標を持たない要素の一覧を1画面に表示する。
//
// URL契約: ?platformId=&patternId=（docs/spec/design.md「URL契約」）。
// 未指定・不正値は先頭にフォールバックする（500にしない。#94 の parseUuidParam と同じ思想）。
export default async function StationLayoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ stationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { stationId } = await params;
  const raw = await searchParams;
  const platformId = parseUuidParam(raw.platformId);
  const patternId = parseUuidParam(raw.patternId);

  const context = await stationLayoutPageQuery.getContext(stationId, { platformId, patternId });
  if (!context) notFound();

  return <StationLayoutView stationId={stationId} context={context} />;
}
