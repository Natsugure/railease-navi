# 実装タスク: 駅・路線一覧を事業者スコープ化し、絞り込みと並び替えを追加する (Issue #94)

- **対象**: `apps/admin`
- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **作成日**: 2026-09-10
- **ブランチ**: `feature/issue94-list-scoping`（PR1 / PR2）
- **信頼度**: 88%（高）

## 進捗（2026-09-10）

- PR1（`shared/list/` + 駅一覧の Query Service 化）: 実装・検証完了
- PR2（路線一覧の Query Service 化）: 実装・検証完了
  - PR2 着手時に `OperatorPicker` / `OperatorCard` を `features/station/` から
    `shared/list/` へ移設（ADR-0001 の feature 間依存ルールに抵触するため。
    line ⇄ station は許可された依存ではない）

## フェーズ構成

```
PR1: 仕様整備 + ADR-0009 + shared/list/ + 駅一覧
  Phase 0: 仕様3点セットの全面書き換え + ADR-0009
  Phase 1: shared/list/ の共通契約
  Phase 2: 駅一覧の縦切り（ports → query → components → page → di → eslint）
  Phase 3: PR1 検証

PR2: 路線一覧
  Phase 4: 路線一覧の縦切り（PR1 の契約を再利用）
  Phase 5: ドキュメントと引き渡し
```

### 実行順序の根拠

`shared/list/` の契約（`ListParams` / `ListResult` / `buildListHref` /
`SortableTh` / `ListPagination`）は画面をまたいで再利用する共通資産であり、
1画面目（駅一覧）の実装を通して検証してから2画面目（路線一覧）に適用する方が、
最初から2画面分を仮定して設計するより手戻りが少ない（ADR-0002「port を推測で
設計してはならない」と同じ理由）。

---

## PR1: shared/list/ + 駅一覧

- [x] **TASK-0.1** `docs/spec/requirements.md` を全面書き換え
- [x] **TASK-0.2** `docs/spec/design.md` を全面書き換え
- [x] **TASK-0.3** `docs/spec/tasks.md`（本ファイル）を全面書き換え
- [x] **TASK-0.4** `docs/adr/0009-list-query-server-side-scoping.md` を新規作成（Proposed）
- [x] **TASK-0.5** `docs/adr/README.md` の一覧表に ADR-0009 を追加

- [x] **TASK-1.1** `shared/list/params.ts` を新規作成。`ListParams` / `ListResult` /
      `parseListParams` / `singleParam` / `parseUuidParam` / `escapeLikePattern`
- [x] **TASK-1.2** `shared/list/params.test.ts` を新規作成。既定値・不正値フォールバック・
      配列値・空白トリム・UUID検証・LIKEエスケープをカバー（16ケース）
- [x] **TASK-1.3** `shared/list/href.ts` を新規作成。`buildListHref`（純関数）
- [x] **TASK-1.4** `shared/list/href.test.ts` を新規作成（8ケース）
- [x] **TASK-1.5** `shared/list/SortableTh.tsx` を新規作成（Client Component）。
      内部で `buildListHref` を呼ぶ（関数 props を受け取らない設計。
      設計変更の経緯は design.md「Server Component → Client Component の
      関数 props 制約」参照）
- [x] **TASK-1.6** `shared/list/ListPagination.tsx` を新規作成（Client Component、
      同様の設計）

- [x] **TASK-2.1** `features/station/ports.ts` に追記: `StationListSort` /
      `STATION_LIST_SORT_KEYS` / `StationListScope` / `StationListRow` /
      `OperatorCard` / `StationListContext` / `StationListPageQuery`
- [x] **TASK-2.2** `external/query/stationListPageQuery.ts` を新規作成。
      スコープ・検索・並び替え・ページングをすべて SQL 側で処理し、
      スコープ・検索語が無いときは一覧・件数クエリを発行しない
- [x] **TASK-2.3** `features/station/components/OperatorPicker.tsx` を新規作成
      （Server Component。空状態の事業者カード一覧）
- [x] **TASK-2.4** `features/station/components/StationListToolbar.tsx` を新規作成
      （Client Component。事業者/路線セレクト + デバウンス検索）
- [x] **TASK-2.5** `app/stations/page.tsx` を全面書き換え。`db` の直接 import を
      無くし `@/di` 経由の Query Service のみを呼ぶ
- [x] **TASK-2.6** `app/stations/loading.tsx` にツールバー分のスケルトンを追加
- [x] **TASK-2.7** `di.ts` に `stationListPageQuery` を配線
- [x] **TASK-2.8** `eslint.config.mjs` の `legacyExclusions` から
      `src/app/stations/page.tsx` を除去
- [x] **TASK-2.9** `e2e/stations-list.spec.ts` を新規作成。空状態・スコープ遷移・
      並び替え・検索・LIKEエスケープ・不正パラメータの7ケース

### Phase 3: PR1 検証

- [x] `pnpm run typecheck`（admin）→ エラー0
- [x] `pnpm run lint`（admin、変更ファイル対象）→ 0 problems
- [x] `pnpm exec vitest run`（admin）→ 333/333 passed（新規24件含む）
- [x] `pnpm exec next build`（admin）→ 成功
- [x] 実データに対する直接 SQL 検証（Neon MCP、`development` ブランチ）:
      件数一致（JR東日本1,961駅）、路線ブロックの連続性（86路線=86ブロック）、
      `name_kana` ソートの妥当性、LIKE エスケープの効果（`q='_'`: 未エスケープなら
      10,625件・エスケープ後0件）
- [x] Playwright E2E（`next dev`、Credentials バイパス）:
      `e2e/stations-list.spec.ts` 7/7 pass、既存スイート回帰なし
      （`operators.spec.ts` の1件失敗は本 Issue 対象外の `OperatorForm.tsx`
      に起因する既存不具合。未着手ファイルであることを diff で確認済み。
      別途 Issue 化を検討）

---

## PR2: 路線一覧

- [x] **TASK-4.0** `features/station/components/OperatorPicker.tsx` と
      `OperatorCard` 型を `shared/list/`（`OperatorPicker.tsx` /
      `operatorCard.ts`）へ移設。駅一覧側の import も追従（`app/stations/page.tsx`、
      `features/station/ports.ts`、`external/query/stationListPageQuery.ts`）
- [x] **TASK-4.1** `features/line/ports.ts` に追記: `LineListSort` /
      `LINE_LIST_SORT_KEYS` / `LineListScope` / `LineListRow`（駅数列を含む）/
      `LineListContext` / `LineListPageQuery`
- [x] **TASK-4.2** `external/query/lineListPageQuery.ts` を新規作成。
      駅一覧と同じ契約（`ListParams` / `ListResult`）に従う。駅数は当該ページの
      路線IDのみ `inArray` + `GROUP BY` で畳む
- [x] **TASK-4.3** `features/line/components/LineListToolbar.tsx` を新規作成
      （事業者セレクト + 検索。路線セレクトは無い）
- [x] **TASK-4.4** `app/lines/page.tsx` を全面書き換え
- [x] **TASK-4.5** `app/lines/loading.tsx` にツールバー分のスケルトンを追加
- [x] **TASK-4.6** `di.ts` に `lineListPageQuery` を配線
- [x] **TASK-4.7** `eslint.config.mjs` の `legacyExclusions` から
      `src/app/lines/page.tsx` を除去
- [x] **TASK-4.8** `e2e/lines-list.spec.ts` を新規作成（5ケース）

### Phase 4: PR2 検証

- [x] `pnpm run typecheck`（admin）→ エラー0
- [x] `pnpm run lint`（admin、変更ファイル対象）→ 0 problems
- [x] `pnpm exec vitest run`（admin）→ 333/333 passed（回帰なし）
- [x] `pnpm exec next build`（admin）→ 成功
- [x] 実データに対する直接 SQL 検証（Neon MCP）: JR東日本の路線数（86件）が
      一覧の総件数と一致
- [x] Playwright E2E: `e2e/lines-list.spec.ts` 5/5 pass。全スイート実行で
      24件中23件 pass（1件は `operators.spec.ts` の既存不具合。下記参照）

### Phase 5: ドキュメントと引き渡し

- [x] `docs/domain/station-master-model.md` に `station_lines.station_order` の
      NULL 実態（97%）と `ekidata_station_cd` フォールバックの事実を追記
- [x] ADR-0009 のステータスは `Proposed` のまま残す（実装・E2E検証は完了したが、
      本番相当の負荷・運用を経た検証ではないため `Accepted` への昇格は見送る。
      ADR README の「実装・検証を通過した」が本番相当の運用実績を含むかは
      解釈の余地があるが、保守的に判断した）
- [x] 後続 Issue の起票を検討（起票は開発者判断のため本 Issue では GitHub Issue
      作成まで行わず、ここに記録するに留める）:
      - `station_lines.station_order` のデータ移行（ekidata_station_cd から
        補完し、フォールバックを解消する）
      - `OperatorForm.tsx` の「表示優先度」ラベル関連付けの不具合。本 Issue の
        作業中に E2E（`operators.spec.ts` 既存テスト）で偶発的に検出。
        `getByLabel(/表示優先度/)` が要素を見つけられない。本 Issue が
        触れていないファイルのため対応せず、事実の記録のみ行う
