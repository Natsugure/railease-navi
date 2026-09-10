# 設計: 駅・路線一覧を事業者スコープ化し、絞り込みと並び替えを追加する (Issue #94)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md) /
  ADR-0001 / ADR-0002 / ADR-0003 / [ADR-0009](../adr/0009-list-query-server-side-scoping.md)
- **作成日**: 2026-09-10

## 適応的実行戦略

信頼度88%（高）。段階的実装に進む。唯一の新規アーキテクチャ判断は
ADR-0009（一覧の絞り込みをサーバー側で行う契約）で、これは実装着手前に決定済み。
PoC は設けない。

## PR 構成

```
PR1: 仕様整備 + ADR-0009 + shared/list/ + 駅一覧
  └─ PR2: 路線一覧（PR1 の契約を2画面目で検証）
```

## 全体アーキテクチャ

```
app/stations/page.tsx (Server Component)
  │ searchParams (Promise) を解析
  ├─ parseUuidParam(operatorId, lineId)      shared/list/params.ts
  ├─ parseListParams<StationListSort>(...)   shared/list/params.ts
  ↓
di.ts → stationListPageQuery.getListContext(scope, params)
  ↓
external/query/stationListPageQuery.ts
  │ Drizzle。WHERE / ORDER BY / LIMIT OFFSET はすべてここで組み立てる
  ↓
StationListContext (DTO) を返す
  ↓
app/stations/page.tsx が描画
  ├─ StationListToolbar ('use client')       … 事業者/路線セレクト・検索入力
  ├─ shared/list/OperatorPicker (Server Component) … スコープ未選択時の事業者カード
  ├─ SortableTh ('use client')               … 列ヘッダクリックでソート
  └─ ListPagination ('use client')           … ページング
```

`shared/list/`（ADR-0001 が定義、これまで未使用）を駅一覧・路線一覧の共通契約の
置き場とする。Drizzle も Next.js 固有 API も import しない（`params.ts` /
`href.ts` / `operatorCard.ts`）。`SortableTh.tsx` / `ListPagination.tsx` /
`OperatorPicker.tsx` は `next/navigation` や `next/link` を使うため Client
Component（または `next/link` を使う Server Component）だが、DB へは依存しない。

**PR2 で判明した設計変更**: `OperatorPicker` と `OperatorCard` 型は当初
`features/station/components/` に置いたが、路線一覧（`features/line/`）からも
同じコンポーネントを使う必要があり、これは ADR-0001 の feature 間依存ルール
（許可された依存は `platform` / `station` / `stop-pattern` の組み合わせのみで、
`line ⇄ station` は含まれない）に抵触する。`shared/list/OperatorPicker.tsx` +
`shared/list/operatorCard.ts` へ移設し、両 feature の `ports.ts` がそこから
`OperatorCard` 型を import する形にした。

### 層ごとの依存（ADR-0001 の再確認）

| ファイル | 層 | 依存してよいもの |
|---|---|---|
| `shared/list/params.ts` `href.ts` | shared | なし（純粋関数） |
| `shared/list/SortableTh.tsx` `ListPagination.tsx` | shared | `next/navigation`, `@mantine/core` |
| `features/station/ports.ts` | features/ports | なし（`@furatora/database/enums` のみ例外） |
| `external/query/stationListPageQuery.ts` | external | `@furatora/database`, `drizzle-orm` |
| `app/stations/page.tsx` | app | 上記すべて + `next/navigation` |

## Server Component → Client Component の関数 props 制約

RSC はシリアライズ不可能な値（関数）を Server → Client の props 境界を越えて
渡せない。実装中に2件この制約に抵触し、設計を修正した。

1. **`SortableTh` / `ListPagination` に `buildHref: (next) => string` を渡す案は
   採用しなかった。** 代わりに `current`（現在の URL 状態オブジェクト）・
   `basePath`・`defaults` をデータとして渡し、`buildListHref` はこれらの
   Client Component が内部で呼ぶ。
2. **`OperatorPicker`（Server Component）で `<Card component={Link} href={...}>`
   は使えない。** Mantine の `Card` は Client Component であり、`component` prop に
   関数（`Link`）を渡すことは Server → Client 境界を越える関数渡しになり
   `"Functions cannot be passed directly to Client Components"` で失敗する。
   `<Link href={...}><Card>...</Card></Link>`（`Link` で `Card` を包み、children
   として渡す）に変更した。children として渡す要素は事前にレンダリングされた
   React 要素であり、関数渡しには当たらない。

## データフロー: 駅一覧

### URL 契約

```
/stations?operatorId=&lineId=&q=&sort=&order=&page=
```

| 状態 | 表示 | 発行クエリ |
|---|---|---|
| すべて未指定 | 事業者カード一覧（`OperatorPicker`） | 事業者セレクト用 + カード用（GROUP BY） |
| `q` のみ | 全国横断の部分一致結果（事業者・路線列を表示） | 一覧 + `count(*)` |
| `operatorId` | その事業者の駅（路線列を表示） | 路線セレクト + 一覧 + `count(*)` |
| `operatorId` + `lineId` | その路線の駅（路線列を隠し見出しに出す） | 同上 |

### `StationListContext`（DTO。ADR-0003 の制約: JSON シリアライズ可能、UI 固有値を含まない）

```ts
// features/station/ports.ts
export type StationListSort = 'line' | 'code' | 'name' | 'published';

export type StationListRow = {
  id: string; name: string; nameEn: string | null; code: string | null;
  publishedAt: string | null;   // ISO文字列（Date のまま返さない）
  stationOrder: number | null;
  lineId: string; lineName: string; lineColor: string | null; operatorName: string;
};

export type StationListContext = {
  operators: OperatorOption[];        // 常に返す（事業者セレクト。162件）
  operatorCards: OperatorCard[];      // スコープ・検索語が無いときだけ（空状態のカード）
  lines: LineOption[];                // operatorId 指定時のみ
  scope: { operatorName: string | null; lineName: string | null; lineColor: string | null };
  result: ListResult<StationListRow> | null;  // 何も無いときは null（クエリ未発行）
};

export interface StationListPageQuery {
  getListContext(
    scope: { operatorId?: string; lineId?: string },
    params: ListParams<StationListSort>,
  ): Promise<StationListContext>;
}
```

`shared/list/params.ts` の共通型:

```ts
export type SortOrder = 'asc' | 'desc';
export type ListParams<TSort extends string> = {
  q: string | null; sort: TSort; order: SortOrder; page: number; perPage: number;
};
export type ListResult<TRow> = { rows: TRow[]; total: number; page: number; perPage: number };
```

### SQL 組み立て（`external/query/stationListPageQuery.ts`）

- スコープ: `operatorId` → `eq(lines.operatorId, ...)`、`lineId` →
  `eq(stationLines.lineId, ...)`（両方指定時は AND）
- 検索: `or(ilike(stations.name, p), ilike(stations.nameEn, p), ilike(stations.code, p))`、
  `p = '%' + escapeLikePattern(q) + '%'`
- 並び替え（`StationListSort` → Drizzle 式。詳細は requirements.md「並び順の
  フォールバック」）:

  | sort | ORDER BY |
  |---|---|
  | `line`（既定） | `lines.displayOrder`, `stationLines.stationOrder ASC NULLS LAST`, `stations.ekidataStationCd ASC NULLS LAST`, `stations.id ASC` |
  | `name` | `stations.nameKana`, `stations.id ASC` |
  | `code` | `stations.code ASC/DESC NULLS LAST`, `stations.id ASC` |
  | `published` | `stations.publishedAt ASC/DESC NULLS LAST`, `stations.id ASC` |

  `order=desc` で反転するのは選択中のキーのみ。フォールバックと末尾の
  `stations.id ASC` は常に固定する（OFFSET ページングの安定性）。
- 一覧本体と `count(*)` は `Promise.all` で並列発行する
- `showResult = Boolean(scope.operatorId || scope.lineId || params.q)` が false の
  ときは `result: null` を返し、一覧・件数のクエリを発行しない

### 検証済みの実データ挙動（2026-09-10, Neon `development` に対する直接クエリで確認）

- JR東日本スコープ（86路線・1,961駅）の上記 ORDER BY で、各路線の駅は
  連続したブロックとして並ぶ（`lines.displayOrder` が実質0でタイしていても、
  `ekidataStationCd` のブロック構造により路線をまたいだ混在は発生しない。
  86路線 = 86ブロックであることを window 関数で確認済み）
- `name_kana` ソートは 秋葉原→池袋→上野→鶯谷→恵比寿→大崎 の五十音順になる
  （山手線で確認済み）
- LIKE エスケープ無しで `q='_'` を検索すると全10,625駅にヒットする
  （`_` はワイルドカードとして「任意の1文字」を意味するため）。
  `escapeLikePattern` 適用後は 0 件（実データに文字どおりの `_` を含む駅名は無い）。
  この差分により `escapeLikePattern` の必要性を実データで確認した

## データフロー: 路線一覧

駅一覧と同じ形。差分のみ記載する。

- URL: `/lines?operatorId=&q=&sort=&order=&page=`（`lineId` は無い。一覧そのものが
  路線なので路線スコープの概念が無い）
- `LineListSort`: `'displayOrder' | 'name' | 'lineCode' | 'operator'`
  - `name` は `lines.nameKana`（`stations` と同じ collation 制約）
  - `operator` は `operators.name`
- 検索: 路線名 / `lineCode` / 事業者名の部分一致
- 行に **駅数** 列を追加する。`inArray(lines.id, pageLineIds)` で当該ページの
  路線IDだけ `count(stationLines.stationId)` を `GROUP BY` して Map で畳む
  （`facilityEditPageQuery.ts` の畳み込みイディオムを踏襲。ページ内の路線だけを
  対象にするため602件の集計にはならない）
- 空状態は駅一覧と同じ `OperatorPicker`（`basePath="/lines"`）
- 「編集 / 方面を管理 / 隣接を管理」の操作列は現行を踏襲する

## エラーハンドリング

| ケース | 挙動 |
|---|---|
| `operatorId` / `lineId` が UUID 形式でない | `parseUuidParam` が `undefined` にフォールバック（未指定と同じ扱い）。500 にしない |
| `sort` が未知の値 | `parseListParams` が `defaultSort` にフォールバック |
| `order` が `asc`/`desc` 以外 | `asc` にフォールバック |
| `page` が数値でない・0以下・小数 | `1` にフォールバック |
| 該当0件 | 「該当する駅（路線）が見つかりません。」を表示し、テーブル・ページングを描画しない |

いずれも実測で500にならないことを確認済み（`?sort=bogus&page=-1&operatorId=not-a-uuid`
で `heading "駅"` が正常に表示されることを E2E で検証）。

## ユニットテスト戦略

- `shared/list/params.test.ts`: `parseListParams`（既定値・不正値フォールバック・
  配列値・空白トリム）、`parseUuidParam`（正常/不正/未指定/配列）、
  `escapeLikePattern`（`% _ \` のエスケープ）
- `shared/list/href.test.ts`: `buildListHref`（パッチ適用・null でキー削除・
  既定値の非出力・`resetPageOn` による page リセット）
- Query Service（`stationListPageQuery.ts` / `lineListPageQuery.ts`）は
  ユニットテストを設けない。`apps/CLAUDE.md` の方針どおり Route Handler は
  DI モックでテストするが、Server Component が直接呼ぶ Query Service には
  そのテスト先例が無く、本 Issue も既存パターンを踏襲してユニットテスト対象外とする。
  代わりに実データに対する直接 SQL 検証（設計時）と Playwright E2E（実装後）で
  カバーする
- `app/stations/page.tsx` `app/lines/page.tsx` は Server Component のため
  ユニットテスト対象外（`apps/CLAUDE.md`）。E2E でカバーする

## 手動検証（実施記録）

`PLAYWRIGHT_TEST=true pnpm dev`（admin :3001、Neon `development`）で、
ブラウザ自動化が利用できない環境だったため以下で代替した。

1. **Neon MCP による直接 SQL 検証**: Query Service が組み立てる SQL を手で再現し、
   件数・並び順・ブロック連続性・LIKE エスケープの効果を確認（上記「検証済みの
   実データ挙動」）
2. **Playwright E2E**（`e2e/stations-list.spec.ts`）: 実際に `next dev` を起動し
   Chromium で実行。既存 `e2e/operators.spec.ts` と同じ Credentials プロバイダ
   バイパス（`PLAYWRIGHT_TEST=true`）を使用
3. **`next build`**: 本番ビルドが警告・エラー無しで通ることを確認

## ドキュメント更新（Phase 5）

- `docs/domain/station-master-model.md`: `station_lines.station_order` が
  97%（10,294/10,625）NULLであり、路線内の駅順は実質 `ekidata_station_cd` が
  担っているという実測事実を追記する（恒久知識）
- `docs/adr/README.md`: ADR-0009 を一覧表に追加済み
- `apps/admin/eslint.config.mjs`: `legacyExclusions` から
  `stations/page.tsx` `lines/page.tsx` を除去する
