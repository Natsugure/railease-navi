# 実装タスク: admin フォームの props 化と型ルール有効化 (Issue #49 / #50)

- **対象**: `apps/admin`, `apps/web`, `packages/eslint-config`, `packages/typescript-config`, リポジトリルート
- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **作成日**: 2026-09-06
- **ブランチ**: `feature/issue49-50-form-props-and-strict-index`（PR1） / その上に PR2
- **信頼度**: 90%（高）

## フェーズ構成

```
PR1 (Issue #49)
  Phase 1: Query Service の追加（ports + external/query + di 配線）
  Phase 2: フォームの props 化（useEffect 削除）と親ページ置換
  Phase 3: 未使用 API GET の撤去
  Phase 4: no-floating-promises を error 化・legacyExclusions 削減
  Phase 5: 検証（lint / test / build / 手動）

PR2 (Issue #50)
  Phase 6: noUncheckedIndexedAccess 有効化と型エラー解消（admin → web）
  Phase 7: typecheck スクリプト + CI ワークフロー
  Phase 8: 検証（typecheck / test / build）

Phase 9: ドキュメント更新（docs/domain 確認・#48/#32 起票更新）・引き渡し
```

### 実行順序の根拠

- Phase 1 → 2: DTO の形が決まらないとフォームの props 型が書けない
- Phase 3 は Phase 2 の後。GET を消す前にフォームが fetch をやめている必要がある
- Phase 4 は Phase 2/3 の後。違反が残ったまま `error` にすると lint が落ちる
- PR2 を PR1 の上に積む理由は design.md「PR 構成」参照（同一ファイル衝突の最小化）

---

## PR1: Issue #49

### Phase 1: Query Service の追加

- [ ] **TASK-1.1** `features/train/ports.ts` を新規作成。`TrainEditPageQuery`
      インターフェースと `OperatorOption` / `LineOption` / `TrainEditContext` DTO 型
- [ ] **TASK-1.2** `features/line/ports.ts` を新規作成（feature ディレクトリごと）。
      `LineEditPageQuery` / `LineDirectionEditPageQuery` と関連 DTO
- [ ] **TASK-1.3** `features/station/ports.ts` を新規作成。`StationEditPageQuery`。
      `ConnectionRow` 型を `StationEditForm.tsx` からここへ移設
- [ ] **TASK-1.4** `features/platform/ports.ts` に `PlatformEditPageQuery` と
      `LineWithDirections` / `PlatformEditContext` を追記
- [ ] **TASK-1.5** `features/facility/ports.ts` に `FacilityEditPageQuery` と
      `ConnectedStationOption` / `FacilityEditContext` を追記
- [ ] **TASK-1.6** `db:studio` で `lines` / `line_directions` の件数を確認し、
      `PlatformEditContext.lines` を丸ごと渡してもサイズが問題ないことを記録
- [ ] **TASK-1.7** `external/query/trainEditPageQuery.ts` 実装。`operators` 全件 +
      `lines`（`trains.operators`/`trains.lines` の列名に注意）+ 編集時は
      `trains`/`trainEquipments`/`trainCarStructures`（現行 `trains/[trainId]/edit/page.tsx`
      のロジックを移設）
- [ ] **TASK-1.8** `external/query/lineEditPageQuery.ts` 実装。`LineEditPageQuery` は
      `lines` 1件 + `operators` 全件。`LineDirectionEditPageQuery` は路線の駅一覧
      （`stationLines ⋈ stations`、`stationOrder` 順）+ 編集時は `lineDirections` 1件
      （`lineId` 一致を検証）
- [ ] **TASK-1.9** `external/query/stationEditPageQuery.ts` 実装。
      現行 `stations/[stationId]/edit/page.tsx` の `connections` 組み立てを
      そのまま移設し、`operators` 全件を足す
- [ ] **TASK-1.10** `external/query/platformEditPageQuery.ts` 実装。`lines` +
      `lineDirections`（`inArray` で1本、`directionType` で振り分け）→ `LineWithDirections[]`。
      編集時は `platforms` 1件（`stationId` 一致を検証、`physicalLength` は `Number()`）
- [ ] **TASK-1.11** `external/query/facilityEditPageQuery.ts` 実装。接続候補駅
      （現行 `GET /api/stations?connectedFrom=` の JOIN）→ その `stationId[]` で
      `platforms` と方面（`stations/[stationId]/directions` のロジック）を
      `inArray` 各1本引いて畳む。編集時は現行 `facilities/[locationId]/edit/page.tsx`
      の `location` 組み立て（所有権検証含む）を移設
- [ ] **TASK-1.12** `di.ts` に5つの実装を配線（`export const ... = db...PageQuery`）

### Phase 2: フォームの props 化

- [ ] **TASK-2.1** `LineForm.tsx`: `operators` を props に。`useEffect` / `Operator` state 削除
- [ ] **TASK-2.2** `lines/[lineId]/edit/page.tsx`: `lineEditPageQuery.getEditContext` に置換
- [ ] **TASK-2.3** `StationEditForm.tsx`: `operators` を props に。`useEffect` 削除。
      `ConnectionRow` を `features/station/ports.ts` から import に変更（re-export で互換維持）
- [ ] **TASK-2.4** `stations/[stationId]/edit/page.tsx`: `stationEditPageQuery` に置換
- [ ] **TASK-2.5** `TrainForm.tsx`: `operators`/`lines` を props に。`dataLoading`/`<Loader/>` 削除
- [ ] **TASK-2.6** `trains/new/page.tsx`（**同期→async**）・`trains/[trainId]/edit/page.tsx`:
      `trainEditPageQuery` に置換
- [ ] **TASK-2.7** `LineDirectionForm.tsx`: `stations` を props に。
      `loadedLineId`/`stationsLoading`/`useEffect`/`Loader` import 削除
- [ ] **TASK-2.8** `lines/[lineId]/directions/new/page.tsx` ・
      `lines/[lineId]/directions/[directionId]/edit/page.tsx`: `lineDirectionEditPageQuery` に置換
- [ ] **TASK-2.9** `PlatformForm.tsx`: `lines: LineWithDirections[]` を props に。
      `useEffect` 2本 + `Promise.resolve().then()` ハック削除。
      `inbound/outboundDirections` を派生値化。`linesLoading` 削除
- [ ] **TASK-2.10** `stations/[stationId]/platforms/new/page.tsx` ・
      `stations/[stationId]/platforms/[platformId]/edit/page.tsx`: `platformEditPageQuery` に置換
- [ ] **TASK-2.11** `FacilityForm.tsx`: 全データを props に。`useEffect`（:111-168）削除。
      `connectionRows` を `useState(() => ...)` 遅延初期化。
      `connectedStationPlatforms`/`connectedStationDirections` の Record state 廃止、
      `connectedStations` から直接参照。`dataLoading`/`<Loader/>` 削除
- [ ] **TASK-2.12** `stations/[stationId]/facilities/new/page.tsx` ・
      `stations/[stationId]/facilities/[locationId]/edit/page.tsx`: `facilityEditPageQuery` に置換

### Phase 3: 未使用 API GET の撤去

- [ ] **TASK-3.1** ファイル削除: `api/facility-types/route.ts`, `api/lines/route.ts`,
      `api/stations/route.ts`, `api/stations/[stationId]/directions/route.ts`,
      `api/platforms/route.ts`
- [ ] **TASK-3.2** GET のみ削除（POST 維持）: `api/operators/route.ts`,
      `api/lines/[lineId]/directions/route.ts`, `api/stations/[stationId]/platforms/route.ts`。
      未使用 import（`db`/`asc`/`eq` 等）も除去
- [ ] **TASK-3.3** `api/operators/route.test.ts`: `describe('GET /api/operators')` 削除、
      `import { GET, POST }` → `import { POST }`
- [ ] **TASK-3.4** `grep -rn "/api/(operators|lines|facility-types|stations\?|platforms)" apps`
      で参照が本当に消えたことを確認

### Phase 4: ルール有効化

- [ ] **TASK-4.1** `packages/eslint-config/next-app.mjs`: `no-floating-promises` を
      `"error"` に。66-73行の Issue #49 コメント削除
- [ ] **TASK-4.2** `apps/admin/eslint.config.mjs` の `legacyExclusions.files` から
      design.md「ルール有効化」記載の行を削除。`StationEditForm.tsx` の行も削除
- [ ] **TASK-4.3** `pnpm exec eslint .`（apps/admin）で 0 problems を確認。
      過剰削除で `no-restricted-imports` エラーが出たら legacyExclusions に戻す

### Phase 5: PR1 検証

- [ ] **TASK-5.1** `pnpm exec eslint .`（admin / web）→ 0 problems
- [ ] **TASK-5.2** `pnpm run test` → admin は GET テスト削除分だけ減、他は不変
- [ ] **TASK-5.3** `pnpm run build` → 型エラーなし
- [ ] **TASK-5.4** 手動確認（`pnpm run dev`、admin :3001）requirements.md の US-1〜US-4:
      1. `/lines/<id>/edit` — 事業者セレクトが初期描画で埋まっている
      2. `/stations/<id>/edit` — 事業者 + 接続情報の編集・保存
      3. `/trains/new`・`/trains/<id>/edit` — 事業者・路線が即表示、スピナー無し
      4. `/lines/<id>/directions/new` — 駅一覧が即表示
      5. `/stations/<id>/platforms/new` — 路線切替で方面が即入れ替わる／未定義路線で注記
      6. `/stations/<id>/facilities/new`・`.../[id]/edit` — 接続候補駅の行が全て出て
         各駅のホーム・方面が埋まっている。**DevTools Network で `/api/` GET が消えている**
      7. 各フォームの保存が従来どおり成功
- [ ] **TASK-5.5** PR1 作成（gh-stack）

---

## PR2: Issue #50

### Phase 6: noUncheckedIndexedAccess

- [ ] **TASK-6.1** `packages/typescript-config/base.json` に
      `"noUncheckedIndexedAccess": true` を追加
- [ ] **TASK-6.2** `admin/src/external/requireInserted.ts` を新規作成（`returning()` の
      先頭要素を返し、無ければ throw する小関数）
- [ ] **TASK-6.3** admin の型エラーを解消（design.md の表の順）:
      `platformLocationRepository.ts`(6) → `stopPatternRepository.ts`(1) →
      `api/trains/route.ts`(3) → `app/page.tsx`(5) → `StationEditForm.tsx`(9) →
      `romaji.ts`(7、`romaji.test.ts` に末尾「ッ」ケース追加 → 修正)
- [ ] **TASK-6.4** `pnpm exec tsc --noEmit -p apps/admin` → 0 errors
- [ ] **TASK-6.5** web の型エラーを解消:
      `OperatorList.tsx`(1) → `concourseLayout.ts`(4) →
      `TransferDifficultySection.tsx`(11、early return) →
      テスト30件（全件 `!`）
- [ ] **TASK-6.6** `pnpm exec tsc --noEmit -p apps/web` → 0 errors
- [ ] **TASK-6.7** `apps/scripts` / `packages/database` も 0 errors のまま（回帰確認）

### Phase 7: typecheck + CI

- [ ] **TASK-7.1** `apps/scripts` / `packages/database` の `package.json` に
      `"typecheck": "tsc --noEmit"`、`apps/{web,admin}` は
      `"typecheck": "next typegen && tsc --noEmit"`（`next-env.d.ts` と `.next/types`
      が git 管理外のため、型生成の前置が無いと CI で必ず落ちる）
- [ ] **TASK-7.2** ルート `package.json` に `"typecheck": "turbo run typecheck"`
- [ ] **TASK-7.3** `turbo.json` に `typecheck` タスク（`dependsOn: ["^typecheck"]`）
- [ ] **TASK-7.4** `.github/workflows/ci.yml` 新規。`pull_request` で
      install → lint → typecheck → test
- [ ] **TASK-7.5** `act` かローカルで `pnpm run lint && pnpm run typecheck && pnpm run test`
      を `DATABASE_URL` 無しで通す

### Phase 8: PR2 検証

- [ ] **TASK-8.1** `pnpm run typecheck` → 全ワークスペース 0 errors
- [ ] **TASK-8.2** `pnpm run test` → admin 268 相当 / web は 30件のテストが緑
- [ ] **TASK-8.3** `pnpm run build` → 通過
- [ ] **TASK-8.4** `romaji` の末尾「ッ」変換が期待どおりか手動でも確認
- [ ] **TASK-8.5** PR2 作成（gh-stack、PR1 の上）

---

## Phase 9: ドキュメントと引き渡し

- [ ] **TASK-9.1** `docs/domain/` を確認。鉄道ドメインのルールに変更が無ければ
      「本Issueでドメインルールの変更なし（フォームのデータ供給経路の変更のみ）」を
      振り返りに明記。`platform-coordinate-system.md` / `train-stop-patterns.md` の
      記述と実コードの乖離が無いか確認
- [ ] **TASK-9.2** `docs/adr/`: 新規 ADR なし。ADR-0001 / ADR-0003 のステータスは
      触らない（理由は requirements.md スコープ外に記載）
- [ ] **TASK-9.3** GitHub Issue #48 を更新: 本作業で対象が縮小したため、残りを
      `api/stations/[stationId]/platform-locations`・`train-stop-patterns`・
      `api/trains` 系 GET と `app/stations/page.tsx` の N+1 に絞る
- [ ] **TASK-9.4** GitHub Issue #32 を更新: 「directions 読み込み中スピナー」項目は
      `PlatformForm` の props 化で不要になったのでチェックを外す
- [ ] **TASK-9.5** `docs/spec/` の3点セットは次 Issue で全面書き換えされる。
      恒久知識（Query Service の DTO 契約など）が `features/*/ports.ts` の
      コメントに残っていることを確認
- [ ] **TASK-9.6** エグゼクティブサマリーと変更履歴を各 PR 説明に記載

---

## PR #90 レビュー対応

`/code-review` の指摘3件への対応。すべて PR1（Issue #49）で入れたコードが対象。

- [x] **TASK-R.1**（所見1 / Medium）`FacilityForm` の `useState` 遅延初期化が
      props 変化に追随しない。同一ルートパターン内で動的パラメータだけが変わる遷移
      （`/facilities/L1/edit` → `/facilities/L2/edit`）で React がコンポーネントを
      再利用し、前の場所の入力が残る。`useEffect` を戻すのではなく、ページ側で
      `key` を付けて作り直す（`connectionRows` 以外の state も同時に直るため）。
      `PlatformForm` も同じ構造なので同様に対応。`cells` の非 lazy な
      `useState` 初期化も `() =>` に揃えた
- [x] **TASK-R.2**（所見2 / Low）`getLinesWithDirections` が全路線を返す。
      TASK-1.6 で根拠にした「`lines` 62件」が古く、実測は 602件。
      当該駅の `stationLines` に絞る。あわせて `getEditContext` の
      station → platform → lines の3段直列 await を `Promise.all` に。
      `PlatformForm` に路線0件時の注記を追加
- [x] **TASK-R.3**（所見3 / Low）`getConnectedStationOptions` が
      「駅×路線」粒度の JOIN 行をそのまま返し、複数路線の駅を重複させる。
      `ConnectedStationOption` の `lineId`/`lineName` を `lines: {id,name}[]` に変え、
      駅 ID で畳む。`FacilityForm` のラベルは路線名を ` / ` で連結。
      あわせて `getLocationDTO` の cells/connections を `Promise.all` に
- [x] **TASK-R.4** `docs/spec/design.md` の DTO 定義と「62件」の前提を更新
- [x] **TASK-R.5** `docs/domain/` は変更なし。所見3 の根拠
      「1駅=1路線を仮定したコードを書くな」は既に
      `station-master-model.md`「`stationLines` に `unique(stationId)` を付けない」に
      書かれており、今回は実装をその記述に合わせただけ。`docs/adr/` も変更なし
- [x] **TASK-R.6** 検証: eslint 0 problems / `tsc --noEmit` 0 errors /
      vitest 266 passed / `next build` 通過。
      新クエリの生成 SQL を `toSQL()` で確認し、実データで
      「`stationLines` を持たない駅 0件」「自駅の `stationLines` に無い路線を
      参照する `platforms` 0件」「重複する接続ペア 0件」を確認済み
