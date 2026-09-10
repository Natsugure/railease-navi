import { test, expect } from '@playwright/test';

// 駅一覧の事業者スコープ化・検索・並び替え・ページング（Issue #94）。
// operators.spec.ts と同じく実DB（Neon development）に依存する。
// 「JR東日本」「JR山手線」はシード済みマスタデータとして常に存在する
// （docs/domain/station-master-model.md）。

test('スコープ未選択では駅一覧クエリを発行せず、事業者カードを表示する', async ({ page }) => {
  await page.goto('/stations');
  await expect(page.getByText('事業者を選択するか、駅名で検索してください。')).toBeVisible();
  await expect(page.getByRole('link', { name: /JR東日本/ })).toBeVisible();
});

test('事業者カードから遷移すると、その事業者の駅一覧がURLクエリ付きで表示される', async ({ page }) => {
  await page.goto('/stations');
  await page.getByRole('link', { name: /JR東日本/ }).click();

  await expect(page).toHaveURL(/operatorId=/);
  await expect(page.getByRole('columnheader', { name: '路線' })).toBeVisible();
  await expect(page.getByText(/件中/)).toBeVisible();
});

test('路線を選ぶと、その路線の駅だけに絞られ路線見出しが出る', async ({ page }) => {
  await page.goto('/stations');
  await page.getByRole('link', { name: /JR東日本/ }).click();
  await expect(page).toHaveURL(/operatorId=/);

  await page.getByLabel('路線', { exact: true }).selectOption({ label: 'JR山手線' });
  await expect(page).toHaveURL(/lineId=/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.getByText(/JR山手線\s*\(\d+駅\)/)).toBeVisible();

  // 路線スコープ内では「路線」列は隠れ、駅は station_order/ekidata_station_cd の
  // フォールバック順（大崎→五反田→…）で並ぶ
  await expect(page.getByRole('columnheader', { name: '路線' })).not.toBeVisible();
  const firstDataRow = page.locator('tbody tr').first();
  await expect(firstDataRow).toContainText('大崎');
});

test('駅名ヘッダをクリックすると並び替えURLになり、もう一度で降順になる', async ({ page }) => {
  await page.goto('/stations?operatorId=&q=東京');
  // 事業者未選択の検索でも一覧が出る（受け入れ基準: 検索は全国横断）
  await page.goto('/stations?q=東京');
  await expect(page.getByRole('columnheader', { name: '事業者' })).toBeVisible();

  await page.getByRole('button', { name: '駅名で並び替え' }).click();
  await expect(page).toHaveURL(/sort=name/);

  await page.getByRole('button', { name: '駅名で並び替え' }).click();
  await expect(page).toHaveURL(/order=desc/);
});

test('検索語のワイルドカードはエスケープされる（全件ヒットしない）', async ({ page }) => {
  await page.goto('/stations?q=_');
  // ナビゲーション直後は next dev のストリーミングで一瞬コンテンツが二重に見える
  // ことがあるため、まず落ち着かせてから検証する（settled DOM で1個だけになる）
  await page.waitForLoadState('networkidle');
  // 「_」を含む駅名は実データに存在しないため、ワイルドカードとして解釈されていれば
  // 全件（10,625件）にヒットしてしまうが、エスケープされていれば0件になる
  await expect(page.getByText('事業者を選択するか、駅名で検索してください。')).not.toBeVisible();
  await expect(page.getByText('該当する駅が見つかりません。')).toBeVisible();
});

test('不正なクエリパラメータでも500にならず既定値にフォールバックする', async ({ page }) => {
  const response = await page.goto('/stations?sort=bogus&page=-1&operatorId=not-a-uuid');
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole('heading', { name: '駅' })).toBeVisible();
});
