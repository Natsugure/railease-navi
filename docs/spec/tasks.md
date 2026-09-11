# 実装タスク: 駅の設備編集を図ベースの単一ページに統合する (Issue #95)

- **対象**: `apps/admin`、`apps/web`、`packages/platform-diagram`（新設）
- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **作成日**: 2026-09-11
- **ブランチ**: `feature/issue95-phase0-spec`（PR1）以降、子ブランチをスタック
- **信頼度**: 70%（中）

## 進捗（2026-09-11）

- PR1（仕様整備 + ADR-0010 + `packages/platform-diagram` 新設）: 着手中

## フェーズ構成

```
PR1: 仕様整備 + ADR-0010 + packages/platform-diagram 新設（web 移行、挙動不変）
  Phase 0: 仕様3点セットの全面書き換え + ADR-0010
  Phase 1: packages/platform-diagram 新設、web からの移設
  Phase 2: PR1 検証

PR2: 読み取り専用の統合ページ
  Phase 3: Query Service（stationLayoutPageQuery）
  Phase 4: 統合ページの縦切り（読み取り専用。ドラッグ編集なし）
  Phase 5: PR2 検証

PR3: 図上編集
  Phase 6: snap.ts（px→m逆変換・スナップ・丸め）
  Phase 7: DiagramEditLayer（ドラッグ・bounds凍結・未保存state）
  Phase 8: 保存（既存APIへの接続）
  Phase 9: PR3 検証

PR4: テキストフォーム統合
  Phase 10: インスペクタ（Mantineフォーム）
  Phase 11: 複製フロー刷新(#31) / 路線自動設定(#32①) / #51見える化
  Phase 12: PR4 検証

PR5: 旧ルート削除・引き渡し
  Phase 13: 旧ルート削除・リダイレクト、legacyExclusions解消
  Phase 14: ドキュメントと引き渡し
```

### 実行順序の根拠

パッケージ切り出し（PR1）を独立させるのは、挙動不変のリファクタであり web が
壊れていないことだけで検証が完結するため。図編集の新規性（PR3）と混ぜると、
どちらの不具合か切り分けにくくなる。読み取り専用の統合ページ（PR2）を先に完成させ、
実データでの描画を確認してから編集機能（PR3）に進むのは、design.md「適応的実行戦略」
のとおり信頼度70%（中）に対する段階的検証。

---

## PR1: 仕様整備 + ADR-0010 + packages/platform-diagram 新設

- [x] **TASK-0.1** `docs/spec/requirements.md` を全面書き換え
- [x] **TASK-0.2** `docs/spec/design.md` を全面書き換え
- [x] **TASK-0.3** `docs/spec/tasks.md`（本ファイル）を全面書き換え
- [x] **TASK-0.4** `docs/adr/0010-platform-diagram-package-edit-layer.md` を新規作成（Proposed）
- [x] **TASK-0.5** `docs/adr/README.md` の一覧表に ADR-0010 を追加

- [x] **TASK-1.1** `packages/platform-diagram/package.json` を新規作成
      （`@furatora/database` と同じ raw .ts export 方式）
- [x] **TASK-1.2** `packages/platform-diagram/tsconfig.json` を新規作成
      （`@furatora/typescript-config/base.json` を継承）
- [x] **TASK-1.3** `packages/platform-diagram/eslint.config.mjs` を新規作成。
      `base.mjs` だけでは TypeScript 構文を解析できなかった（parsing error）ため、
      `eslint-config-next/typescript`（TSパーサ・typescript-eslintルール）を追加し、
      `no-restricted-imports` で `next/*` と `@furatora/database`/`drizzle-orm` を禁止
- [x] **TASK-1.4** `packages/platform-diagram/vitest.config.ts` を新規作成。
      DOM を使うテストが無いため `environment: 'node'`（jsdomではない）
- [x] **TASK-1.5** `packages/platform-diagram/README.md` を新規作成
- [x] **TASK-1.6** `apps/web/src/features/platform/domain/` の8ファイル + 6テストを
      `packages/platform-diagram/src/domain/` へ `git mv`。相対import（`./types` 等）は
      ディレクトリ構造を1階層ぶんそのまま保ったため無変更で解決した
- [x] **TASK-1.7** `packages/platform-diagram/src/domain/index.ts` を新規作成（バレル）
- [x] **TASK-1.8** `PlatformDiagram.tsx` / `diagram/DiagramSvg.tsx` /
      `overlay/ConcoursePlateRow.tsx` / `overlay/FacingTransferBannerRow.tsx` を
      `packages/platform-diagram/src/components/` へ `git mv`
- [x] **TASK-1.9** `DiagramSvg.tsx` に `iconBasePath` prop を追加（既定値 `/icons`）。
      `FACILITY_ICONS`（絶対パス）を `FACILITY_ICON_FILES`（ファイル名のみ）に変更し
      `${iconBasePath}/${file}` で組み立てる形にした
- [x] **TASK-1.10** `packages/platform-diagram/src/components/index.ts` を新規作成
      （バレル。`PlatformDiagram` に加え内部3層も export）
- [x] **TASK-1.11** `packages/platform-diagram/src/styles.css` を新規作成。
      design.md「移設対象のCSS変数」の解決済み値で定義
- [x] **設計訂正**: 当初「web の globals.css から移設トークンを削除し web も
      package の styles.css を import する」計画だったが、実装時に
      `--color-bg-card`/`--color-border-default`/`--color-border-strong`/
      `--color-text-primary`/`--color-text-secondary` の5つが `@theme inline` 経由で
      `body` の背景色・文字色にも使われる **web 全体の基盤トークン**と判明
      （`grep` で実使用箇所を確認）。削除すると web 全体が壊れるため、
      **web の globals.css は一切変更しない**方針に修正。package の styles.css は
      admin だけが import する（design.md「移設対象のCSS変数」節に訂正を追記済み）
- [x] **TASK-1.14** `apps/web/src/features/platform/components/PlatformDisplay.tsx` /
      `PlatformTabs.tsx` の import を `@furatora/platform-diagram/domain` /
      `@furatora/platform-diagram/components` に付け替え。加えて `grep` で
      旧パスへの残存参照を全文検索し、`features/station/domain/{tabs.ts,types.ts}` /
      `features/station/usecases/getStationDetail.test.ts` /
      `features/station/domain/tabs.test.ts` /
      `external/query/stationDetailQuery.ts` の計5ファイルも同様に付け替えた
      （当初のタスク分解には無かった。実装時に発見）
- [x] **TASK-1.15** `apps/web/package.json` に `@furatora/platform-diagram: workspace:*` を追加
- [x] **TASK-1.16** ルート `tsconfig.json` の `references` に
      `packages/platform-diagram` を追加
- [x] **TASK-1.17** 不要と判明。`next build` が `transpilePackages` 無しで成功したため
      `next.config.ts` は新設しなかった（`@furatora/database` と同じ raw .ts export
      パッケージを Next.js の既定のワークスペース解決がそのまま扱えている）

### Phase 2: PR1 検証

- [x] `pnpm install`（workspace解決の確認）→ 成功
- [x] `pnpm run typecheck`（リポジトリ全体、turbo経由）→ 全7パッケージでエラー0
- [x] `pnpm run lint`（リポジトリ全体）→ 全パッケージで 0 problems
- [x] `pnpm run test`（リポジトリ全体）→ platform-diagram 154件（移設分。
      web側テストの移動分を含めた実カウントは133件ではなく154件だった。
      requirements.md「133テスト」という記述は概算で、実数は本タスクで確定） /
      web 13件 / admin 333件、すべて pass。admin は無変更で回帰なし
- [x] `pnpm run build`（リポジトリ全体）→ web・admin ともに成功
- [x] **挙動不変の確認**: web の `PlatformDisplay.tsx`/`PlatformTabs.tsx` は
      import 文以外を変更していない（コンポーネントロジック・JSXは無変更）。
      `layoutRows()` 等の実装ファイル自体も `git mv` のみで内容変更なし
      （`iconBasePath` はオプショナルprop・既定値 `/icons` のため web の呼び出し側は
      無変更でも従来どおり動作する）。テスト154件が移設前後で1件も変わらず
      pass することをもって挙動不変を確認とする
      （スクリーンショット比較は環境上実施せず、コード上の不変性で代替）

---

## PR2: 読み取り専用の統合ページ

- [ ] **TASK-3.1** `apps/admin/src/features/station-layout/ports.ts` を新規作成:
      `StationLayoutContext` / `LayoutPlatformDTO` / `LayoutPlatformDetailDTO` /
      `StationLayoutPageQuery`
- [ ] **TASK-3.2** `apps/admin/src/external/query/stationLayoutPageQuery.ts` を新規作成。
      1駅分のホーム・コンコース・cells・facilities・connections・停車パターンを
      1本のQuery Serviceに集約する（`facilities/page.tsx` の7クエリを置き換え）
- [ ] **TASK-4.1** `apps/admin/src/app/stations/[stationId]/layout/page.tsx` を新規作成
      （Server Component。`?platformId=&patternId=` を解析し Query Service を1回呼ぶ）
- [ ] **TASK-4.2** `apps/admin/src/features/station-layout/components/StationLayoutView.tsx`
      を新規作成（読み取り専用。`@furatora/platform-diagram/components` の
      `PlatformDiagram` をそのまま描画するだけ。ドラッグ機能は含まない）
- [ ] **TASK-4.3** `apps/admin/public/icons/` を新設し web の6アイコンPNGをコピー
- [ ] **TASK-4.4** `apps/admin/src/app/layout.tsx` に BIZ UDPGothic フォントと
      `@furatora/platform-diagram/styles.css` の import を追加
- [ ] **TASK-4.5** `apps/admin/package.json` に `@furatora/platform-diagram: workspace:*` を追加
- [ ] **TASK-4.6** `di.ts` に `stationLayoutPageQuery` を配線

### Phase 5: PR2 検証

- [ ] `pnpm run typecheck` / `lint` / `vitest run` / `next build`（admin）
- [ ] Neon `development` への直接 SQL 照合（コンコース件数・cells件数・停車パターン件数が
      図の表示と一致すること）
- [ ] Playwright で `/stations/{id}/layout` が描画されることを確認
- [ ] 対面乗り換え駅（赤坂見附・表参道）での手動確認。design.md「手動検証計画」参照

---

## PR3: 図上編集

- [ ] **TASK-6.1** `packages/platform-diagram/src/domain/snap.ts` を新規作成:
      `pxToMeters` / `snapMeters` / `roundToDecimal2`
- [ ] **TASK-6.2** `snap.test.ts` を新規作成: グリッド丸め／号車境界スナップ／
      ドア中心スナップ／許容範囲外／Alt解除相当（スナップ無効時）／負座標／範囲外
- [ ] **TASK-7.1** `apps/admin/src/features/station-layout/components/StationLayoutEditor.tsx`
      を新規作成（`'use client'`。未保存stateの保持、ホーム/パターン切替時の確認モーダル）
- [ ] **TASK-7.2** `apps/admin/src/features/station-layout/components/DiagramEditLayer.tsx`
      を新規作成（`xFraction()` で位置合わせしたポインタイベントハンドル。
      bounds凍結、Alt検出、スナップ候補の算出）
- [ ] **TASK-8.1** アクセス点ドラッグの保存を実装
      （`PUT /api/stations/{sid}/platform-locations/{lid}` を呼ぶ）
- [ ] **TASK-8.2** 号車境界ドラッグの保存を実装
      （`PUT /api/stations/{sid}/train-stop-patterns/{pid}` を呼ぶ）
- [ ] **TASK-8.3** 未保存バッジ・保存後の選択状態復元（`(concourseId, xPositionMeters)`）を実装

### Phase 9: PR3 検証

- [ ] `pnpm run typecheck` / `lint` / `vitest run` / `next build`（admin / packages/platform-diagram）
- [ ] RTL で pointer イベントによるドラッグをシミュレートするテストを追加
- [ ] 保存後に DB の値が期待どおりか SQL で確認

---

## PR4: テキストフォーム統合

- [ ] **TASK-10.1〜10.n** インスペクタ（`components/inspector/*.tsx`）を新規作成。
      既存 `FacilityForm.tsx` / `PlatformForm.tsx` / `TrainStopPatternForm.tsx` の
      入力項目をMantineフォームとして移植する（詳細はPR2〜3完了後にtasks.mdへ追記）
- [ ] **TASK-11.1** 複製フローをクライアント側コピー方式に刷新（#31）
- [ ] **TASK-11.2** ホーム追加時の路線自動設定を実装（#32①）
- [ ] **TASK-11.3** 座標を持たない要素セクションと「位置を入力」導線を実装（#51見える化）

### Phase 12: PR4 検証

- [ ] `pnpm run typecheck` / `lint` / `vitest run` / `next build`
- [ ] 複製 → x をずらす → 保存が1画面で完結すること
- [ ] 位置未入力のコンコースが警告として出ること

---

## PR5: 旧ルート削除・引き渡し

- [ ] **TASK-13.1** `/stations/[stationId]/facilities` を `/layout` へのリダイレクトに変更
- [ ] **TASK-13.2** `/facilities/new`、`/facilities/[locationId]/edit`、`/platforms/new`、
      `/platforms/[platformId]/edit`、`/platforms/[platformId]/stop-patterns/**` を削除
- [ ] **TASK-13.3** `FacilityForm.tsx` / `PlatformForm.tsx` / `TrainStopPatternForm.tsx` /
      `FacilityDuplicateButton.tsx` と対応する `duplicate` エンドポイントを削除
- [ ] **TASK-13.4** `eslint.config.mjs` の `legacyExclusions` から該当エントリを削除

### Phase 14: ドキュメントと引き渡し

- [ ] `docs/domain/platform-coordinate-system.md` の「E2E検証未完了」注記を除去し
      「レイヤ構成」に編集レイヤを追記
- [ ] `docs/domain/train-stop-patterns.md` の「E2E検証未完了」注記を除去
- [ ] ADR-0010 のステータス判断（`Proposed` → `Accepted` はユーザー承認後）
- [ ] 関連Issueの処理:
      - **#32** をクローズ。①は本Issueが吸収、②はclient fetch廃止で解消済み、
        **③は#29のメートル座標化で前提が失われたため取り下げ**、と理由を記録する
      - **#31** をクローズ（本Issueが吸収）
      - **#51** はオープンのまま。本Issueが見える化するだけでスキーマ変更は残ることを追記
      - **#29** の親Issueがクローズ漏れしている可能性を確認（Phase 6 = #43はCLOSED）
- [ ] 後続Issueとして起票を検討（起票は開発者判断のため記録に留める）:
      - **[admin] 設備アグリゲートの書き込みを全置換から部分更新へ改める**:
        `platformLocationCells` / `stationFacilities` へ `createdAt`/`updatedAt` 追加、
        `update` を diff更新へ、`duplicate` の読みをトランザクション内へ、
        `PlatformLocationRepository` 全メソッドへ `stationId` スコープ検証を追加
        （現在は他駅のデータをURL直打ちで更新・削除できる）
