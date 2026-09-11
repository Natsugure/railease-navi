import { test, expect } from '@playwright/test';

// 駅レイアウト統合ページ（Issue #95 PR2、読み取り専用）。
// operators.spec.ts / stations-list.spec.ts と同じく実DB（Neon development）に依存する。
// 「東京メトロ」はシード済みマスタデータとして常に存在する事業者
// （docs/domain/station-master-model.md、stations-list.spec.ts の「JR東日本」と同様の前提）。

// 駅一覧の検索結果から「管理」リンク（/stations/{id}/facilities）の href を辿って
// stationId を得る。このページはまだ一覧からリンクされていない（PR2の範囲外。
// リンク付け替えは旧ルート削除と一体のPR5で行う）ため、既存の /facilities リンクの
// id 部分を流用する
async function findStationId(page: import('@playwright/test').Page, query: string): Promise<string> {
  await page.goto('/stations');
  await page.getByRole('link', { name: /東京メトロ/ }).click();
  await page.getByLabel('検索').fill(query);
  await page.waitForURL(/q=/);
  const href = await page.getByRole('link', { name: '管理' }).first().getAttribute('href');
  const match = href?.match(/\/stations\/([^/]+)\/facilities/);
  if (!match) throw new Error(`駅「${query}」の管理リンクが見つからない: ${href}`);
  return match[1]!;
}

test('駅レイアウトページが表示され、ホームタブで切り替えられる', async ({ page }) => {
  const stationId = await findStationId(page, '渋谷');

  await page.goto(`/stations/${stationId}/layout`);
  await expect(page.getByRole('heading', { name: '渋谷' })).toBeVisible();

  // ホームタブが1つ以上表示される（駅にホームが登録されていれば）
  const platformTabs = page.getByRole('link', { name: /番線$/ });
  const tabCount = await platformTabs.count();
  if (tabCount > 1) {
    // 2つ目のタブに切り替えるとURLの platformId が変わる
    await platformTabs.nth(1).click();
    await expect(page).toHaveURL(/platformId=/);
  }
});

test('不正なUUIDの platformId を渡しても500にならず先頭ホームにフォールバックする', async ({ page }) => {
  const stationId = await findStationId(page, '渋谷');

  const response = await page.goto(`/stations/${stationId}/layout?platformId=not-a-uuid&patternId=also-invalid`);
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: '渋谷' })).toBeVisible();
});

test('存在しない駅IDは404になる', async ({ page }) => {
  // next dev（Turbopack）は notFound() 後もHTTPステータスとして200を返す
  // （既存の /facilities でも同じ挙動。本番ビルドでは404になる）ため、
  // ここではNext標準の404ページ内容で判定する
  await page.goto('/stations/00000000-0000-0000-0000-000000000000/layout');
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});
