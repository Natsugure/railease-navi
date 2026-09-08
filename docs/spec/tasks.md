# 実装タスク: 駅・路線マスタの新規作成手段を Admin に実装する (Issue #88)

- **対象**: `apps/admin`
- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **作成日**: 2026-09-08
- **ブランチ**: `feature/issue88-station-master-create`（PR1）/ その上に PR2 / PR3
- **信頼度**: 90%（高）

## 進捗（2026-09-08）

- 実装（Phase 0 / 1 / 3 / 5 / 6 / 7）とドキュメント更新（Phase 9 の docs/domain・schema.ts）は**完了**。
  `pnpm run lint` / `typecheck` / `test`（admin 309）/ `build` すべて通過。
  複合 `ON CONFLICT (...)` の生成 SQL を `toSQL()` で確認済み。
- **未実施**: 各 PR の手動 / E2E 検証（Neon `development` ブランチが要る）、
  gh-stack での PR 作成、後続 Issue の起票（stationGroups 作成 / 駅名重複検出）。

## フェーズ構成

```
PR1: 仕様整備 + 路線の作成
  Phase 0: 仕様3点セットの全面書き換え（本ファイル群）
  Phase 1: 路線作成の縦切り（schema → ports → repository → query → route → form → page → di）
  Phase 2: PR1 検証（lint / typecheck / test / build / 手動）

PR2: 駅の作成
  Phase 3: 駅作成の縦切り（withTransaction で stations + stationLines）
  Phase 4: PR2 検証

PR3: 乗換接続・隣接の作成と削除
  Phase 5: 乗換接続（createPair / deletePair、段階スコープの候補クエリ）
  Phase 6: 隣接（昇順正規化の純粋関数、lineId 所属検証）
  Phase 7: DeleteButton の redirectTo 任意化、StationEditForm への削除導線
  Phase 8: PR3 検証

Phase 9: ドキュメント更新（docs/domain 上書き・schema.ts コメント・Issue 起票）・引き渡し
```

### 実行順序の根拠

- Phase 1 で作成系の最小パターンを固め、Phase 3 / 5 / 6 はその反復にする
- Phase 5/6（`withTransaction` + 複合 `onConflict` + ドメイン正規化）が最もリスクが高いため最後
- Phase 7 は Phase 5/6 の後（削除 API が無いと導線を繋げない）

---

## PR1: 路線の作成

### Phase 0: 仕様整備

- [x] **TASK-0.1** `docs/spec/requirements.md` を Issue #88 用に全面書き換え
- [x] **TASK-0.2** `docs/spec/design.md` を全面書き換え
- [x] **TASK-0.3** `docs/spec/tasks.md`（本ファイル）を全面書き換え

### Phase 1: 路線作成

- [x] **TASK-1.1** `features/line/schema.ts` を新規作成。`lineCreateSchema` +
      `LineCreateInput`（`z.infer`）。`slug` を含めない
- [x] **TASK-1.2** `features/line/schema.test.ts` を新規作成。`name` / `operatorId` 必須、
      不正 uuid の拒否。`platform/schema.test.ts` と同型
- [x] **TASK-1.3** `features/line/ports.ts` に `LineRepository` / `LineRecord` と
      `LineEditPageQuery.getCreateContext()` / `LineCreateContext` を追記
- [x] **TASK-1.4** `external/repository/lineRepository.ts` を新規作成（`db`。
      `platformRepository.ts` の `create` と同型。`requireInserted` で受ける）
- [x] **TASK-1.5** `external/query/lineEditPageQuery.ts` に `getCreateContext()` を追記
      （既存 `getOperatorOptions()` を再利用）
- [x] **TASK-1.6** `app/api/lines/route.ts` を新規作成。`POST`。
      `platforms/route.ts` + `publication/route.ts`（JSON parse ガード）と同型。
      **`@furatora/database` を import しない**（`@/di` 経由）
- [x] **TASK-1.7** `components/LineForm.tsx` を新規/編集兼用に改修。
      `lineId?` / `initialData?` を任意化。`lineId` の有無で `PUT` / `POST` を切替。
      ボタンラベル `lineId ? '更新' : '作成'`。`OperatorForm` パターンを踏襲
- [x] **TASK-1.8** `app/lines/new/page.tsx` を新規作成。
      `lineEditPageQuery.getCreateContext()` で事業者を渡して `<LineForm operators={...} />`
- [x] **TASK-1.9** `app/lines/page.tsx` の見出しを `Group justify="space-between"` にして
      「+ 新規」（`LinkButton href="/lines/new"`）を追加
- [x] **TASK-1.10** `di.ts` に `lineRepository` を配線
- [x] **TASK-1.11** ESLint 境界の確認: `app/api/lines/route.ts` に一時的に
      `import { db } from '@furatora/database/client';` を足し、`pnpm run lint` が
      その行でエラーになることを確認して戻す

### Phase 2: PR1 検証

- [ ] **TASK-2.1** `pnpm run lint` → 0 problems
- [ ] **TASK-2.2** `pnpm --filter @furatora/admin typecheck` → 0 errors
- [ ] **TASK-2.3** `pnpm --filter @furatora/admin test` → 新規 schema/route テストが緑、既存不変
- [ ] **TASK-2.4** `pnpm run build` → 通過
- [ ] **TASK-2.5** 手動（admin :3001）: `/lines/new` で作成 → `/lines` に出る。
      `/lines/[id]/edit` が従来どおり更新できる（兼用改修の回帰確認）
- [ ] **TASK-2.6** PR1 作成（gh-stack）

---

## PR2: 駅の作成

### Phase 3: 駅作成

- [x] **TASK-3.1** `features/station/schema.ts` を新規作成。`stationCreateSchema` +
      `StationCreateInput`。**`slug` を含めない**
- [x] **TASK-3.2** `features/station/schema.test.ts` を新規作成
- [x] **TASK-3.3** `features/station/ports.ts` に `StationRepository` / `StationRecord`、
      `StationCreatePageQuery` / `StationCreateContext` / `StationGroupOption` を追記
- [x] **TASK-3.4** `external/repository/stationRepository.ts` を新規作成（**`withTransaction`**）。
      `stations` INSERT → 返却 id で `stationLines` INSERT。
      23503（FK 違反）を `err.cause.code` 方式で検知する `isForeignKeyViolation` を実装し
      `StationReferenceNotFoundError` を throw
- [x] **TASK-3.5** `external/query/stationCreatePageQuery.ts` を新規作成。
      `operators` 全件 + `lines` 全件（`id`/`name`/`operatorId`）+
      `prefCode` 指定時のみ `stationGroups` を絞って返す
- [x] **TASK-3.6** `app/api/stations/route.ts` を新規作成。`POST`。
      `StationReferenceNotFoundError` → 422
- [x] **TASK-3.7** `components/StationCreateForm.tsx` を新規作成（軽量）。
      事業者→路線の段階セレクト、`prefCode` 変更で `router.push('/stations/new?prefCode=')`、
      グループセレクト（任意）。`POST /api/stations`
- [x] **TASK-3.8** `app/stations/new/page.tsx` を新規作成。
      `searchParams.prefCode` を `getCreateContext` に渡す
- [x] **TASK-3.9** `app/stations/page.tsx` の見出しに「+ 新規」を追加
- [x] **TASK-3.10** `di.ts` に `stationRepository` / `stationCreatePageQuery` を配線

### Phase 4: PR2 検証

- [ ] **TASK-4.1** `pnpm run lint` / `typecheck` / `test` / `build`
- [ ] **TASK-4.2** 手動: `/stations/new` で作成 → `/stations` の該当路線配下に出る。
      `db:studio` で `stations` 1行 + `stationLines` 1行、`publishedAt`/`slug`/`ekidataStationCd` が NULL
- [ ] **TASK-4.3** 手動: 作成した駅を `/stations/[id]/publish` から公開できる
- [ ] **TASK-4.4** `stationRepository.create` の tx を `toSQL()` またはログで確認し、
      `stationLines` INSERT 失敗時に `stations` 行が残らないことを確認
      （存在しない `lineId` を直接 POST して 422 と DB 未変更を確認）
- [ ] **TASK-4.5** PR2 作成（gh-stack、PR1 の上）

---

## PR3: 乗換接続・隣接の作成と削除

### Phase 5: 乗換接続

- [x] **TASK-5.1** `features/station-connection/schema.ts` +
      `schema.test.ts`。`stationConnectionCreateSchema`
- [x] **TASK-5.2** `features/station-connection/ports.ts`。
      `StationConnectionRepository.createPair()` / `deletePair()`、
      `StationConnectionCreatePageQuery.getCreateContext()`、関連 DTO
- [x] **TASK-5.3** `external/repository/stationConnectionRepository.ts`。
      `createPair` は `withTransaction` + 2行 `values([...])` +
      `onConflictDoNothing({ target: [stationConnections.stationId, stationConnections.connectedStationId] })`。
      `deletePair` は `or(and(...), and(...))` の単一 DELETE
- [x] **TASK-5.4** `external/query/stationConnectionCreatePageQuery.ts`。
      段階スコープ（operatorId 未指定→事業者のみ / 指定→路線 / lineId 指定→路線内の駅、自駅除外）。
      **全駅を一度に読まない**
- [x] **TASK-5.5** `app/api/stations/[stationId]/connections/route.ts`（`POST`）。
      自己接続（`connectedStationId === stationId`）→ 400。冪等なので既存でも 201
- [x] **TASK-5.6** `app/api/stations/[stationId]/connections/[connectedStationId]/route.ts`（`DELETE`）。
      0行なら 404
- [x] **TASK-5.7** `app/stations/[stationId]/connections/new/page.tsx`。
      `searchParams` の `operatorId` / `lineId` でスコープ、セレクト変更で `router.push`
- [x] **TASK-5.8** `di.ts` に `stationConnectionRepository` / `stationConnectionCreatePageQuery` を配線
- [x] **TASK-5.9** route ハンドラテスト（`vi.mock('@/di')`）: 正常系 / 自己接続 400 / zod 400

### Phase 6: 隣接

- [x] **TASK-6.1** `features/station-adjacency/domain/normalize.ts` +
      `normalize.test.ts`。`normalizeAdjacencyEndpoints(x, y)`
- [x] **TASK-6.2** `features/station-adjacency/schema.ts` + `schema.test.ts`。
      `.refine()` で自己隣接を拒否
- [x] **TASK-6.3** `features/station-adjacency/ports.ts`。
      `StationAdjacencyRepository.create()` / `delete()`、
      `StationAdjacencyPageQuery.getPageContext()`、`AdjacencyEndpointNotOnLineError`、関連 DTO
- [x] **TASK-6.4** `external/repository/stationAdjacencyRepository.ts`（`db`）。
      `stationLines` で両端点の `lineId` 所属を検証 → 不足なら `AdjacencyEndpointNotOnLineError`。
      `normalizeAdjacencyEndpoints` を通してから
      `onConflictDoNothing({ target: [lineId, stationAId, stationBId] })`
- [x] **TASK-6.5** `external/query/stationAdjacencyPageQuery.ts`。
      路線名 + 駅一覧（`stationOrder` 順）+ 既存隣接行（両端点の駅名を JOIN）
- [x] **TASK-6.6** `app/api/lines/[lineId]/adjacencies/route.ts`（`POST`）。
      `AdjacencyEndpointNotOnLineError` → 422
- [x] **TASK-6.7** `app/api/lines/[lineId]/adjacencies/[adjacencyId]/route.ts`（`DELETE`）
- [x] **TASK-6.8** `app/lines/[lineId]/adjacencies/page.tsx`。
      `lines/[lineId]/directions/` と同じ階層・構成
- [x] **TASK-6.9** `app/lines/page.tsx` の操作列に「隣接を管理」を追加
- [x] **TASK-6.10** `di.ts` に `stationAdjacencyRepository` / `stationAdjacencyPageQuery` を配線
- [x] **TASK-6.11** route ハンドラテスト: 正常系 / 端点不整合 422 / 自己隣接 400

### Phase 7: 削除ボタンと駅編集ページ導線

- [x] **TASK-7.1** `components/DeleteButton.tsx` の `redirectTo` を任意化
      （省略時は `router.refresh()` のみ）。既存呼び出し元は全て `redirectTo` を渡すため後方互換
- [x] **TASK-7.2** `features/station/ports.ts` の `ConnectionRow` に
      `connectedStationId: string` を追加。`external/query/stationEditPageQuery.ts` も対応
- [x] **TASK-7.3** `components/StationEditForm.tsx`: 接続一覧テーブルに削除列
      （`DeleteButton endpoint={/api/stations/${stationId}/connections/${conn.connectedStationId}}`）、
      見出しに「接続を追加」リンク。**`handleSave` の PUT fetch 群は変更しない**

### Phase 8: PR3 検証

- [ ] **TASK-8.1** `pnpm run lint` / `typecheck` / `test` / `build`
- [ ] **TASK-8.2** 手動: 接続追加 → `db:studio` で2行・`source='manual'`。再実行で増えない
- [ ] **TASK-8.3** 手動: 駅編集ページで接続削除 → 2行とも消える
- [ ] **TASK-8.4** 手動: 隣接追加 → 逆向きで再追加しても増えない（`normalize` の確認）
- [ ] **TASK-8.5** 手動: 隣接の端点が路線外 → 422（別路線の駅を直接 POST）
- [ ] **TASK-8.6** `toSQL()` で複合 `ON CONFLICT (...)` 句・候補クエリのスコープ絞りを確認
- [ ] **TASK-8.7** PR3 作成（gh-stack、PR2 の上）

---

## Phase 9: ドキュメントと引き渡し

- [x] **TASK-9.1** `docs/domain/station-master-model.md` を上書き:
      - 冒頭の適用状況注記から「既存行の更新しかできず…新規作成する UI / API は無い」を削除
      - 「隣接」節: 「現時点でそれを担保するコードは存在しない」→ 実装場所
        （`apps/admin/src/features/station-adjacency/domain/normalize.ts`）の明記に置換
      - 「乗換接続」節: 「現時点で行を追加する手段は無い」を削除し、作成経路
        （`POST /api/stations/[stationId]/connections`、有向2行・冪等）を記述
- [x] **TASK-9.2** `docs/domain/station-visibility.md`:
      「書き込み側（Admin の公開操作）」節の前後に、新規駅が
      `publishedAt = NULL` / `slug = NULL` で作られ、作成フォームは `slug` を扱わないことを追記
- [x] **TASK-9.3** `packages/database/src/schema.ts`:
      `stationConnections` の `unique_station_connection` コメントの
      「現時点でこのテーブルへ INSERT するコードは無い（作成 API / UI は Issue #88）」を、
      `stationConnectionRepository.createPair` を指す記述に更新。
      `stationAdjacencies` の「この表に書き込むコードは端点 UUID を昇順へ正規化してから」の
      コメントに実装場所（`normalizeAdjacencyEndpoints`）を追記
- [x] **TASK-9.4** `docs/adr/`: 新規 ADR なし。既存 ADR のステータスも変更しない
- [ ] **TASK-9.5** GitHub Issue 起票:
      1. `[station-master] stationGroups の新規作成手段`（`ekidataStationGroupCd` の
         NOT NULL 解除を伴うドメイン判断。ADR 要）
      2. `[admin] 駅作成時の駅名重複検出`（`normalize.ts` の再実装。
         正規化規則は station-master-model.md「駅名の正規化ルール」に記載済み）
- [ ] **TASK-9.6** `docs/spec/` は次 Issue で全面書き換えされる。恒久知識
      （隣接の昇順正規化・乗換接続の有向2行）が `features/*/ports.ts` /
      `schema.ts` のコメントと `docs/domain/` に残っていることを確認
- [ ] **TASK-9.7** 各 PR にエグゼクティブサマリーと変更履歴を記載
