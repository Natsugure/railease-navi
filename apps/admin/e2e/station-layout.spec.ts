import { test, expect } from '@playwright/test';

// 実DB（Neon development）に依存する。「東京メトロ」はシード済みの事業者

/** 駅一覧の「管理」リンク（/stations/{id}/facilities）から stationId を得る */
// 一覧から /layout へのリンク付け替えはPR5で行う。それまでは /facilities の id を流用する
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
  // next dev は notFound() 後もステータス200を返すため、404ページの内容で判定する
  await page.goto('/stations/00000000-0000-0000-0000-000000000000/layout');
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});

test('UUID形式でない駅IDは500にならず404になる', async ({ page }) => {
  const response = await page.goto('/stations/not-a-uuid/layout');
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});
