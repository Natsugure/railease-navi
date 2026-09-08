# 要件: 駅・路線マスタの新規作成手段を Admin に実装する (Issue #88)

## 概要

- **対象**: `apps/admin`
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) /
  [ADR-0001](../adr/0001-layer-structure.md) / [ADR-0002](../adr/0002-dependency-inversion-ports.md) /
  [ADR-0003](../adr/0003-read-write-separation.md) / [ADR-0005](../adr/0005-write-atomicity-driver.md) /
  [ADR-0007](../adr/0007-station-master-data-source.md) /
  [docs/domain/station-master-model.md](../domain/station-master-model.md)
- **作成日**: 2026-09-08
- **ブランチ**: `feature/issue88-station-master-create`
- **信頼度**: 90%（高）— 対象4テーブルのスキーマ・制約・既存参照箇所、既存の
  Repository / Query Service / route / フォームの実装パターンを実測で確認済み。
  新しいアーキテクチャ判断（Server Actions 等）は持ち込まず、既存パターンの複製に徹する。

## 背景

ADR-0007（Accepted）決定1で「駅・路線マスタの投入後の維持は Admin での手動編集が主経路」と決め、
決定4に従って取込・突合の機構（`master-import` / `master-migration`）を Issue #56 Phase 7 で削除した。
その結果、以下のテーブルに行を追加する手段がコード上から消えた。

| テーブル | 参照 | 更新 | 作成 | 削除 |
|---|---|---|---|---|
| `operators` | ✅ | ✅ | ✅ `POST /api/operators` | ✅ |
| `stations` | ✅ | ✅ `PUT /api/stations/[stationId]` | ❌ | ❌ |
| `lines` | ✅ | ✅ `PUT /api/lines/[lineId]` | ❌ | ❌ |
| `stationConnections` | ✅ | ✅ `PUT /api/station-connections/[connectionId]` | ❌ | ❌ |
| `stationAdjacencies` | **アプリコードでの参照ゼロ** | ❌ | ❌ | ❌ |
| `stationGroups` | — | — | ❌ | ❌ |

このため、新駅・新路線の開業に対応できず、`station_g_cd` が捉えない乗り換え
（地下通路・連絡改札で繋がる別グループ間）を `source = 'manual'` で足すこともできない。
`docs/domain/station-master-model.md` が想定している運用が実行不能な状態にある。

## スコープ

### やること

- `stations` / `lines` の作成 API と Admin UI
- `stationConnections` の作成・削除 API と Admin UI（有向2行を対で作成・削除、冪等）
- `stationAdjacencies` の作成・削除 API と Admin UI（端点 UUID の昇順正規化を書き込み側で実装）

### やらないこと（別 Issue へ）

- `stationGroups` の新規作成。`ekidataStationGroupCd` が NOT NULL + UNIQUE のため、
  スキーマ変更なしには作成できない。ekidata コードを持たない乗換単位の識別方法という
  ドメイン判断が要るため、独立した Issue + ADR で扱う。本 Issue の駅作成フォームは
  **既存グループへの紐付けのみ**を扱う
- 駅名の重複検出。正規化規則は `station-master-model.md`「駅名の正規化ルール」に
  記載済みだが、旧実装（`features/master-import/domain/normalize.ts`）は削除済みで
  再実装になる。作成フォームの警告として入れる要件が未確定のため別 Issue へ
- 既存の PUT ルート群・既存フォームの書き換え。本 Issue は作成・削除経路の追加のみ
- 一覧の事業者スコープ化・検索・並び替え（#94）、ダッシュボード整理（#93）、
  設備編集の図統合（#95）。UI は既存構成を最小限踏襲するに留める
- `serviceRoutes` / `serviceRouteSegments` などの運行系統概念（#83）

## 既存パターンの踏襲（新規性を持ち込まない）

| 層 | 既存のお手本 |
|---|---|
| 書き込み API | `POST /api/stations/[stationId]/platforms/route.ts`（`@/di` 経由の Repository・zod feature schema・201・ドメインエラー→HTTP写像） |
| ドメインエラー→HTTP | `PATCH /api/stations/[stationId]/publication/route.ts`（409/422/404/400、JSON parse ガード） |
| ports + 実装 + 配線 | `features/*/ports.ts` + `external/repository/*.ts` + `di.ts` |
| zod スキーマ | `features/platform/schema.ts`（`z.infer` で Input 型 export、`schema.test.ts` を対で） |
| 作成フォーム | `OperatorForm.tsx`（`useState` + `fetch` + `router.push`/`refresh`、失敗時 `alert`） |
| 作成ページ | `app/operators/new/page.tsx` / `app/trains/new/page.tsx`（`getCreateContext()` で選択肢） |
| 選択肢供給 | `LineDirectionEditPageQuery.getCreateContext(lineId)`（Server Component の props、クライアント `fetch` 新設なし） |
| 削除ボタン | `components/DeleteButton.tsx`（`endpoint` に `DELETE` fetch → Mantine Modal 確認） |
| トランザクション | `stationPublishingRepository.ts`（`withTransaction`、23505 は `err.cause.code`、`isUniqueViolation`） |

**追加しないもの**: `'use server'` / Server Action、`revalidatePath`、新規 ADR、
`packages/eslint-config` の変更、`src/shared/` への新規基盤ファイル。

## ユーザーストーリーと受け入れ基準（EARS 記法）

### US-1: 新規路線を作成する

**管理者が路線の新規作成フォームを送信したとき、システムは `lines` に1行を追加し、
一覧に反映すること。**

- 受け入れ基準:
  - `/lines/new` に事業者セレクトが初期描画時点で埋まっている
  - `name` と `operatorId` は必須。未入力なら 400 で弾かれフォームに留まる
  - 作成後、`/lines` 一覧の該当事業者の行に新路線が出る
  - 新規行の `ekidataLineCd` / `slug` は NULL
  - `/lines` に「+ 新規」への導線がある

### US-2: 新規駅を作成する

**管理者が駅の新規作成フォームを送信したとき、システムは `stations` に1行と
`stationLines` に1行を1トランザクションで追加すること。**

- 受け入れ基準:
  - `/stations/new` に事業者・路線のセレクトが初期描画時点で埋まっている
  - `name` / `operatorId` / `lineId` は必須
  - 作成された駅は `publishedAt = NULL` / `slug = NULL`。一覧・検索・詳細・公開APIに出ない
  - フォームに `slug` 入力欄が無い（公開操作で確定する。station-master-model.md）
  - 新規行の `ekidataStationCd` は NULL
  - 作成後、`/stations` の該当路線配下に新駅が出て、`/stations/[id]/publish` から公開できる
  - `stations` INSERT 後に `stationLines` INSERT が失敗した場合、`stations` の行も残らない

### US-3: 乗換接続を追加する

**管理者が駅Aから駅Bへの乗換接続を追加したとき、システムは `stationConnections` に
`(A→B)` と `(B→A)` の2行を1トランザクションで `source = 'manual'` として追加すること。**

- 受け入れ基準:
  - `/stations/[stationId]/connections/new` で相手駅を事業者→路線で段階的に絞って選べる
  - 全10,625駅を一度に読み込むクエリが発行されない
  - 同じ組を再度追加しても行が増えない（`unique_station_connection` を衝突対象にした冪等 upsert）
  - `connectedStationId === stationId`（自己接続）は 400 で弾かれる
  - 駅編集ページの接続一覧に「接続を追加」への導線がある

### US-4: 乗換接続を削除する

**管理者が駅編集ページで乗換接続の行を削除したとき、システムは対応する有向2行
（`A→B` と `B→A`）の両方を削除すること。**

- 受け入れ基準:
  - 駅Aの編集ページで接続（相手B）を削除すると、`(A→B)` と `(B→A)` の両方が消える
  - 削除確認のモーダルが出る（`DeleteButton` の挙動）
  - 削除後、駅編集ページの接続一覧から当該行が消える

### US-5: 路線内の隣接を追加する

**管理者が路線Lの駅Aと駅Bを隣接として追加したとき、システムは端点 UUID を
`(stationAId, stationBId)` の昇順に正規化してから `stationAdjacencies` に1行追加すること。**

- 受け入れ基準:
  - `/lines/[lineId]/adjacencies` に当該路線の駅一覧（`stationLines.stationOrder` 順）が出る
  - `(A, B)` を追加した後、逆向き `(B, A)` で追加しても行が増えない（昇順正規化 + 冪等 upsert）
  - `stationAId === stationBId`（自己隣接）は 400 で弾かれる
  - 端点のいずれかが `lineId` に属さない場合は 422 で弾かれる
  - `/lines` に「隣接を管理」への導線がある

### US-6: 隣接を削除する

**管理者が隣接管理ページで隣接の行を削除したとき、システムは `stationAdjacencies` の
当該行を削除し、同じページに留まって一覧を更新すること。**

- 受け入れ基準:
  - 削除後、隣接一覧から当該行が消える（`router.refresh()` のみ。ページ遷移しない）
  - 削除確認のモーダルが出る

### US-7: 未認証のアクセスを遮断する

**未認証のリクエストが作成・削除 API に届いたとき、システムは 401 を返すこと。**

- 受け入れ基準:
  - `middleware.ts` の matcher が新規 `/api/` ルートを覆っており、未認証は 401

### US-8: 層の分離を守る

**新規に追加する書き込み経路は、ADR-0001 / ADR-0003 の層分離に従うこと。**

- 受け入れ基準:
  - 新規 `route.ts` は `@furatora/database` / `drizzle-orm` を直接 import しない
    （`@/di` 経由。既存 `legacyExclusions` に新規ファイルを追加しない）
  - `features/*/ports.ts` は `next/*` を import しない
  - DB の状態を変えるメソッドは Repository（集約単位）、読み取りは Query Service（DTO）
  - `pnpm run lint` / `pnpm run typecheck` / `pnpm run build` が通る

## 制約

- `develop` / `main` での直接作業は禁止（CLAUDE.md）。ブランチを切ってから着手する
- **本 Issue はスキーマを変更しない**。`db:generate` / `db:push` は不要
- 隣接の昇順正規化は DB 制約で担保できない（`unique_station_adjacency` は
  `(lineId, stationAId, stationBId)` 順序依存で逆向きペアを別行として通す）。
  **書き込み側が守る規約**として実装する（station-master-model.md「隣接」）
- 乗換接続は有向2行で持つ設計。読み取り側が `eq(stationConnections.stationId, stationId)` で
  片方向しか見ないため、UI からは対向行もあわせて作る（station-master-model.md「乗換接続」）
- `withTransaction` 経由の一意制約違反は `err.code` ではなく `err.cause.code` に入る
  （`stationPublishingRepository.ts` の実測コメント）
- `apps/scripts/src/seed-master-data.ts` の `onConflict*` は単一カラム target のみ。
  複合ユニーク制約を衝突対象にするには `target` に配列を渡す（リポジトリ初）

## スコープ外（再掲）

- `stationGroups` の新規作成 → 別 Issue
- 駅名の重複検出 → 別 Issue
- 既存 PUT ルート・既存フォームの書き換え
- #93 / #94 / #95 の UI 刷新
