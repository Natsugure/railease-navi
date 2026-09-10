import { test, expect } from '@playwright/test';

// 路線一覧の事業者スコープ化・検索・並び替え・ページング（Issue #94）。
// stations-list.spec.ts と同じく実DB（Neon development）に依存する。

test('スコープ未選択では路線一覧クエリを発行せず、事業者カードを表示する', async ({ page }) => {
  await page.goto('/lines');
  await expect(page.getByText('事業者を選択するか、路線名で検索してください。')).toBeVisible();
  await expect(page.getByRole('link', { name: /JR東日本/ })).toBeVisible();
});

test('事業者カードから遷移すると、その事業者の路線一覧がURLクエリ付きで表示される', async ({ page }) => {
  await page.goto('/lines');
  await page.getByRole('link', { name: /JR東日本/ }).click();

  await expect(page).toHaveURL(/operatorId=/);
  await expect(page.getByText(/JR東日本の路線\s*\(\d+件\)/)).toBeVisible();
  await expect(page.getByText(/件中/)).toBeVisible();
  // 駅数列が追加されている
  await expect(page.getByRole('columnheader', { name: '駅数' })).toBeVisible();
});

test('名称ヘッダをクリックすると並び替えURLになり、もう一度で降順になる', async ({ page }) => {
  await page.goto('/lines?q=山手');
  await expect(page.getByText('JR山手線')).toBeVisible();

  await page.getByRole('button', { name: '名称で並び替え' }).click();
  await expect(page).toHaveURL(/sort=name/);

  await page.getByRole('button', { name: '名称で並び替え' }).click();
  await expect(page).toHaveURL(/order=desc/);
});

test('検索語のワイルドカードはエスケープされる（全件ヒットしない）', async ({ page }) => {
  await page.goto('/lines?q=_');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('事業者を選択するか、路線名で検索してください。')).not.toBeVisible();
  await expect(page.getByText('該当する路線が見つかりません。')).toBeVisible();
});

test('不正なクエリパラメータでも500にならず既定値にフォールバックする', async ({ page }) => {
  const response = await page.goto('/lines?sort=bogus&page=-1&operatorId=not-a-uuid');
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: '路線' })).toBeVisible();
});
