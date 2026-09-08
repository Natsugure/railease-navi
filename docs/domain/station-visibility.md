# 駅・路線・事業者の公開状態

> **適用状況**: 2026-09-06 現在、**実装済み・本番反映済み**。
> `packages/database/src/schema.ts` および `apps/web/src/external/query/visibility.ts`
> と一致する。ただし **「乗換接続に未公開駅を含めない」という要件の定義が
> [Issue #77](https://github.com/Natsugure/furatora/issues/77) で再検討中**であり、
> 「リンクを伴わない名称のみの参照は許可する」方向で分割される見込み。
> 本書の「乗換接続からの到達」の記述は #77 の決着で更新する。

## 可視性は `stations.publishedAt` が単独で担う

- `stations.publishedAt` が **NULL = 非公開 / 非NULL = 公開**。
- ekidata 由来の新規駅は `publishedAt = NULL` で作られ、
  管理者が Admin の公開操作で明示的に設定するまで、一覧・検索・詳細ページ・
  公開APIのいずれにも出ない。
- **粒度は `stations` 単位。** `stationGroups` / `lines` / `operators` には
  公開フラグを持たせない（YAGNI。必要になったら足す）。
  - 路線・事業者の可視性は「**公開駅を1件以上持つか**」を `EXISTS` で判定する。
- `operators.displayPriority` は**表示順専用**であり、可視性の意味を持たない
  （マイグレーション `0008` で `NOT NULL DEFAULT 0` に純化。かつては「NULL = 非表示」の
  二役だった）。全国展開時の `displayPriority` の運用ルール（誰がどう並び順を決めるか）は
  未定（[Issue #85](https://github.com/Natsugure/furatora/issues/85)）。

## 判定は単一の述語を通す

`apps/web/src/external/query/visibility.ts` の3関数のみが可視性を表現する。
読み取り経路ごとに条件を書かない。

| 関数 | 生成する条件 |
|---|---|
| `publishedStation()` | `stations.published_at IS NOT NULL` |
| `visibleLine()` | `lines.slug IS NOT NULL` **かつ** 公開駅を持つ（相関 `EXISTS`） |
| `visibleOperator()` | 公開駅を持つ（相関 `EXISTS`） |

- 可視性は必ず **`where` 句**に置く。JS 側での絞り込みにしない
  （詳細ページで判定が抜けた現行バグの再発を防ぐ）。
- `visibleLine()` が `lines.slug IS NOT NULL` を含むのは、ekidata 由来の602路線が
  `slug = NULL` で入るため。`LineAccordion` が `/lines/${slug}/stations` へ
  フォールバック無しでリンクしており、放置すると `/lines/null/stations` を生成する。
  不変条件を立てて守るのではなく、述語に含めて**不要にする**。
- この規模（路線602 / 駅10,625）では可視性用の専用インデックスは置かない。

## `published_requires_slug` の CHECK 制約

```
published_at IS NULL OR slug IS NOT NULL
```

公開駅は必ず `slug` を持つ。URL を持てない駅が公開状態になるのを防ぐ。
帰結として、`publishedStation()` を通った行の `slug` は非 NULL として扱ってよい
（`apps/web` の型は `string`、`?? id` フォールバックは持たない）。
`slug` の導出規則は [station-master-model.md](./station-master-model.md#slug-の導出規則)。

## 新規駅の初期状態

Admin の駅新規作成（`POST /api/stations` / `features/station/`。Issue #88）は
`publishedAt = NULL` / `slug = NULL` で行を作る。作成フォームに `slug` 入力欄は無い
（インポート・新規作成では書かず、公開操作で確定する。
[station-master-model.md](./station-master-model.md#slug-の導出規則)）。
CHECK 制約 `published_requires_slug` は `publishedAt = NULL` により自然に満たされる。
新規駅は下記の公開操作を通すまで一覧・検索・詳細・公開APIのいずれにも出ない。

## 書き込み側（Admin の公開操作）

可視性は読み取り側の述語が単独で担保するが、書き込み側でも不整合な状態を作らせない。
`apps/admin` の公開操作（`features/station-publishing/`）は次を守る。

- **所属路線に `slug` が無ければ駅を公開させない**（`LineSlugMissingError` → 422）。
  `visibleLine()` の `slug IS NOT NULL` 条件と揃え、`slug` の無い路線に公開駅がぶら下がる
  状態を作らない。
- **`slug` の重複を弾く**（`SlugTakenError` → 409）。`stations.slug` は一意。
- **非公開に戻しても `slug` は消さない。** 再公開時に同じ URL を維持するため。
- **設備の充足度・`nameEn` は公開条件にしない。** 公開操作画面には確認材料として
  表示するが、条件にすると「とりあえず機械ローマ字を貼る」圧力が生じる。公開の可否は
  常に人が判断する（充足度から自動導出しない）。
- **「公開駅を持つのに `slug` が無い路線」をデータ健全性の警告として一覧表示する。**
  正しさの担保ではなく、`lines.slug` の付け忘れを検知するため。

## 読み取り経路（`apps/web`）

一覧・路線配下の駅一覧・駅名検索・駅詳細・路線ページ・各公開API
（`/api/v1/stations` / `/api/v1/lines/[slug]/stations` / `/api/v1/stations/[id]` /
`/api/v1/operators` ほか）のすべてが上記いずれかの述語を通る。

- 未公開駅の詳細ページ・単体取得APIはアクセスを遮断する（404 / 応答から除外）。
- **既知の制限**: ページ側（`/stations/[slug]` 等）の `notFound()` は正しい
  not-found コンテンツを描画するが HTTP ステータスは 200 のまま返る。
  可視性の実装が原因ではなく、`notFound()` を使う実装全般に及ぶ Next.js の挙動
  （[Issue #70](https://github.com/Natsugure/furatora/issues/70) で追跡）。
  APIルートは明示的に `status: 404` を返すためこの制限を受けない。

## 乗換接続からの到達

`stationDetailQuery.getStationConnectionRows` は未公開駅への接続を除外する
（`publishedStation()` を通す）。concourse の `facilityConnections` クエリは
接続駅名を**リンクを伴わないプレーンな文字列**として返すのみ。

> この節は [Issue #77](https://github.com/Natsugure/furatora/issues/77) の決着で
> 更新する。#77 は「リンクを生成する参照は未公開駅を除外／リンクを伴わない
> 名称のみの参照は許可」へ、この要件を分割する方針。

## 関連

- [ADR-0007](../adr/0007-station-master-data-source.md) — ekidata 移行（可視性の `publishedAt` 一元化を含む）
- [station-master-model.md](./station-master-model.md) — 駅・路線マスタのモデル
- [ADR-0001](../adr/0001-layer-structure.md) — `external/query/` に可視性述語を置く理由
- [Issue #77](https://github.com/Natsugure/furatora/issues/77) / [Issue #70](https://github.com/Natsugure/furatora/issues/70)
