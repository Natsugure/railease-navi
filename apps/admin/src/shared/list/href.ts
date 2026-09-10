// 一覧の URL クエリを組み立てる純関数（Issue #94）。
// スコープ・検索語・ソートを変えたときは page を落とし、既定値はクエリに出さない。

export type ListHrefState = Record<string, string | number | null | undefined>;

/**
 * base（例: '/stations'）に対して、現在の状態に patch を重ねたクエリ文字列を組み立てる。
 * - patch にキーが無ければ current の値を維持する
 * - patch の値が null / undefined / '' なら、そのキーをクエリから落とす
 * - defaults に一致する値は出力しない（URL を短く保つ）
 * - resetPageOn に含まれるキーが変化したときは page を出力しない（1ページ目に戻す）
 */
export function buildListHref(
  base: string,
  current: ListHrefState,
  patch: ListHrefState,
  options: { defaults?: ListHrefState; resetPageOn?: readonly string[] } = {},
): string {
  const defaults = options.defaults ?? {};
  const resetPageOn = options.resetPageOn ?? [];

  const merged: ListHrefState = { ...current, ...patch };

  const scopeChanged = resetPageOn.some(
    (key) => key in patch && String(patch[key] ?? '') !== String(current[key] ?? ''),
  );
  if (scopeChanged) {
    merged.page = undefined;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined || value === '') continue;
    if (key in defaults && String(defaults[key]) === String(value)) continue;
    params.set(key, String(value));
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
