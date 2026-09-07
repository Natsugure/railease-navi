# 要件: admin フォームの props 化と型ルール有効化 (Issue #49 / #50)

## 概要

- **対象**: `apps/admin`, `apps/web`, `packages/eslint-config`, `packages/typescript-config`, リポジトリルート
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) /
  [ADR-0001](../adr/0001-layer-structure.md) / [ADR-0003](../adr/0003-read-write-separation.md)
- **作成日**: 2026-09-06
- **ブランチ**: `feature/issue49-50-form-props-and-strict-index`
- **信頼度**: 90%（高）— 違反箇所と件数を実測で確定済み。Query Service の追加は既存の
  `stopPatternPageQuery` / `stationPublishingPageQuery` にお手本がある

2つの lint / 型ルールが「違反が残っているため無効化されたまま」になっている。
違反を構造的に解消し、ルールを `error` / `true` で常時有効にする。
あわせて型チェックを CI で実行する仕組みを整える。

## 現状の実測値（2026-09-06 時点）

設計判断の前提。数値が変わった場合は本節から再評価する。

| 項目 | 実測 | Issue 本文の記述 |
|---|---|---|
| `no-floating-promises` 違反 | **9件 / 6ファイル**（`pnpm exec eslint .`） | 11件 |
| `noUncheckedIndexedAccess` 有効時の型エラー（フラグ起因） | **admin 31件 / web 46件 = 計77件** | admin 39 / web 51 + 既存9 |
| フラグ無しの型エラー（ベースライン） | **全ワークスペース0件** | apps/web に既存9件 |
| `apps/admin/eslint.config.mjs` の `legacyExclusions` | 39ファイル | — |

### Issue 本文との差分（重要）

Issue #49 / #50 は執筆後にコードが動いたため、本文の記述が古い。

- `src/app/unresolved-connections/page.tsx` は**コミット `4fe1419` で削除済み**。
  #49 が「唯一 restructure が必要」とした最難関は消滅し、残る9件はすべて props 化で解消する。
- `FacilityForm` / `PlatformForm` / `TrainForm` は
  `src/features/{facility,platform,train}/components/` へ移動済み。
- #50 が「スコープ外」とした既存9件（`platformCarStopPositions` / `CarStopPosition` /
  `maxCarCount`）は**すでに解消済み**。→ 該当チェックボックスは対応不要。
- `LineDirectionForm.tsx` の `react-hooks/set-state-in-effect` は現在発火していない
  （`loadedLineId` を使う書き方が該当ルールに当たっていない）。props 化で
  `useEffect` ごと消えるため、いずれにせよ解消される。

### `no-floating-promises` 違反の内訳

すべて `useEffect` 内でマスタデータを fetch し直しているもの。`.catch` が1つも無い。

| ファイル | 行 | 取得しているデータ |
|---|---|---|
| `src/components/LineForm.tsx` | 42 | `GET /api/operators` |
| `src/components/StationEditForm.tsx` | 102 | `GET /api/operators` |
| `src/components/LineDirectionForm.tsx` | 55 | `GET /api/stations?lineId=` |
| `src/features/train/components/TrainForm.tsx` | 58 | `GET /api/operators` + `GET /api/lines` |
| `src/features/platform/components/PlatformForm.tsx` | 56, 66, 69 | `GET /api/lines` / `GET /api/lines/{id}/directions` |
| `src/features/facility/components/FacilityForm.tsx` | 112, 127 | ホーム・設備タイプ・接続候補駅 + 接続候補駅ごとのホーム/方面（N+1） |

### 現状の実害（Issue #49 本文より、実コードで確認済み）

- **失敗時にスピナー永久固着**: `setDataLoading(false)` が成功パスにしかない
  （`FacilityForm` / `TrainForm`）
- **無言で壊れる**: ローディング表示すら無くセレクトが空のまま（`LineForm` / `StationEditForm`）
- **レースコンディション**: `lineId` 変更時に古いレスポンスが後着で勝つ
  （`PlatformForm:69` / `LineDirectionForm:55`。`AbortController` なし）
- **N+1 リクエスト**: `FacilityForm:127` は接続候補駅ごとに2本 fetch を投げ、
  内側 `Promise.all` が外側の `.then` から切り離されており失敗が完全に消える
- **ルール回避ハック**: `PlatformForm:66` の `Promise.resolve().then(() => setDirections([]))`

## ユーザーストーリーと受け入れ基準（EARS 記法）

### US-1: フォームの選択肢を即時表示する

**管理者が編集・新規ページを開いたとき、システムは選択肢（事業者・路線・駅・方面・ホーム）を
最初の描画時点で埋めて表示すること。**

- 受け入れ基準:
  - LineForm / StationEditForm / TrainForm の事業者・路線セレクトが、
    描画直後に選択肢を持つ（従来の「一瞬空」「スピナー」が無い）
  - フォームのどのコンポーネントにも、選択肢取得のための `useEffect` が無い
  - 選択肢はすべて親の Server Component から props で渡る

### US-2: 路線切り替え時に方面が即座に追従する

**PlatformForm で管理者が路線を切り替えたとき、システムは追加の fetch なしに
その路線の上り／下り方面を表示すること。**

- 受け入れ基準:
  - `inboundDirections` / `outboundDirections` が props から引いた純粋な派生値である
  - `Promise.resolve().then(...)` によるルール回避が無い
  - 路線を素早く切り替えても、古い方面リストが後着で勝つことがない

### US-3: 接続候補駅の情報を単一クエリ群でまとめて取得する

**FacilityForm を開いたとき、システムは接続候補駅とそのホーム・方面を、
駅ごとの個別リクエストなしにまとめて取得すること。**

- 受け入れ基準:
  - 接続候補駅の DTO に、その駅のホーム一覧・方面一覧がネストされている
  - フォーム表示時にブラウザから `/api/` への GET が1本も飛ばない
  - `connectionRows` の初期値が props から `useState` の遅延初期化で組み立てられる

### US-4: 望ましくない挙動が構造ごと消える

**選択肢取得の `useEffect` が削除された場合、システムはスピナー固着・無言の失敗・
レース・N+1・ルール回避ハックのいずれも起こさないこと。**

- 受け入れ基準:
  - `dataLoading` / `linesLoading` / `loadedLineId` などの取得用ローディング状態が
    フォームから消えている
  - `pnpm exec eslint .`（apps/admin）が 0 problems

### US-5: 未使用になった API GET を撤去する

**props 化で admin 内から呼び出し元が無くなった GET ハンドラがある場合、
システムはそのコードを残さないこと。**

- 受け入れ基準:
  - `api/facility-types` / `api/lines`（GET） / `api/stations`（GET） /
    `api/stations/[stationId]/directions` の各ルートファイルが削除されている
  - `api/operators` / `api/lines/[lineId]/directions` /
    `api/stations/[stationId]/platforms` から GET だけが削除され、POST は残る
  - 既にデッドコードの `api/platforms/route.ts` も削除されている
  - `api/operators/route.test.ts` の `GET` 記述ブロックが削除され、POST のテストは残る

### US-6: `no-floating-promises` を error に戻す

**#49 の props 化が完了したとき、システムは
`@typescript-eslint/no-floating-promises` を `error` で適用すること。**

- 受け入れ基準:
  - `packages/eslint-config/next-app.mjs` の当該ルールが `"error"`
  - Issue #49 を指す暫定コメントが削除されている
  - `legacyExclusions` から、削除した route と Query Service 化した親ページの行が消えている

### US-7: `noUncheckedIndexedAccess` を有効化する

**`packages/typescript-config/base.json` にフラグが追加されたとき、システムは
`tsc --noEmit` を全ワークスペースでエラーなく通すこと。**

- 受け入れ基準:
  - `base.json` に `"noUncheckedIndexedAccess": true` がある
  - `pnpm run typecheck` が全ワークスペースで 0 errors
  - 対処は箇所ごとに実態に即して判断する（存在チェック / 安全と言える根拠のある
    非 null アサーション / ロジック見直し）。機械的な一律変換をしない
  - テストコード（`*.test.ts`）に限り `!` を許容する（本番コードの安全性に影響しないため）

### US-8: 型チェックを継続的に実行する

**PR が作成されたとき、システムは CI で lint・typecheck・test を実行すること。**

- 受け入れ基準:
  - `apps/*` / `packages/database` に `typecheck` スクリプトがある
  - ルート `package.json` に `typecheck`、`turbo.json` に `typecheck` タスクがある
  - `.github/workflows/` に、`pull_request` で lint → typecheck → test を回す
    ワークフローがある（DB 接続不要。route handler のテストは `db` をモック済み）

## 制約

- `develop` / `main` での直接作業は禁止（CLAUDE.md）。ブランチを切ってから着手する
- ADR-0001 の依存ルール: `src/app/**` と `src/features/*/components/**` から
  `@furatora/database` / `drizzle-orm` を import できない。読み取りは `external/query/` へ置く
- ADR-0003: 読み取りは Query Service（画面・ユースケース単位、DTO を返す、JOIN 自由）。
  汎用 CRUD Repository（`findAll` / `findById`）は禁止
- `packages/database` は web / scripts と共有のため、admin 都合のヘルパーは admin ローカルに置く
- API の POST / PUT ハンドラの挙動は変えない（props 化は読み取り経路のみ）

## スコープ外

- `apps/admin/src/app/stations/page.tsx` の N+1 解消（#48 に残す）
- `api/stations/[stationId]/platform-locations` / `train-stop-patterns` /
  `api/trains` 系 GET の Query Service 化（#48 に残す）
- ADR-0001 / ADR-0003 のステータス変更（#29 の完了判断に属する）
- `features/` に `usecases/` 層を新設すること（現状どの feature にも無く、
  page → query の直呼びが実質標準。本Issueもそれに倣う）
