# 実装タスク: 駅の設備編集を図ベースの単一ページに統合する (Issue #95)

- **対象**: `apps/admin`、`apps/web`、`packages/platform-diagram`（新設）
- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **作成日**: 2026-09-11
- **ブランチ**: `feature/issue95-phase0-spec`（PR1）以降、子ブランチをスタック
- **信頼度**: 70%（中）

## 進捗（2026-09-11）

- PR1（仕様整備 + ADR-0010 + `packages/platform-diagram` 新設）: 完了
- PR2（読み取り専用の統合ページ）: 完了
- PR3（図上編集）: 実装・自動テスト完了。**引き継ぎ事項が2件残る**（下記 Phase 9 参照）:
  サーバー側 refine 追加前のデータ確認SQL、実データでのSQL確認・E2E追加
  （ドラッグ可能な要素を持つ駅が実DBに無い可能性が高いため前処理が必要）

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

- [x] **調査訂正**: design.md「7クエリ」は実カウントと異なると判明。
      旧 `facilities/page.tsx` は実際には8箇所（路線解決が駅の路線数ぶん往復する
      N+1のため、実クエリ本数はホームの路線種別数に依存）。`stationLayoutPageQuery`
      はこの8箇所 + 列車系5テーブル（`trainStopPatterns`/`trainStopPatternCars`/
      `trains`/`trainCarStructures`/`trainEquipments`）を1本に集約する
- [x] **設計訂正**: `StationLayoutContext` は design.md の型（`lines` /
      `facilityTypes` / `connectedStations` / `trains` を含む）から意図的に縮小した。
      これらはPR4のインスペクタ（テキストフォーム統合）専用の選択肢データで、
      読み取り専用のPR2では使わないため（YAGNI）。PR4着手時に `ports.ts` へ追加する
- [x] **設計訂正**: 「そのホームの先頭の停車パターン」の既定順は
      `trainStopPatterns` に表示順カラムが無いため新規に決定した:
      `trains.carCount` 昇順 → `trains.name` 昇順 → `trainStopPatterns.id` 昇順
      （決定性を保つため id まで含める）
- [x] **設計訂正**: ホームタブ・パターンタブは design.md が書く `router.push`
      ではなく通常の `<Link>` で実装した。PR2はページ全体が Server Component の
      ままで完結し、クライアントJSゼロで済むため。`router.push` 化は PR3 で
      未保存state確認が必要になった時点で行う
- [x] **TASK-3.1** `apps/admin/src/features/station-layout/ports.ts` を新規作成:
      `StationLayoutContext` / `LayoutPlatformDTO` / `LayoutPlatformDetailDTO` /
      `LayoutStopPatternDTO` / `StationLayoutPageQuery`
- [x] **TASK-3.2** `apps/admin/src/external/query/stationLayoutPageQuery.ts` を新規作成。
      `apps/web/src/external/query/stationDetailQuery.ts` を写経し、
      (1) `publishedStation()` を外す、(2) 入口を `slug` から `stationId` へ、
      (3) 選択中ホーム1件にスコープする、の3点を変更した
- [x] **TASK-4.1** `apps/admin/src/app/stations/[stationId]/layout/page.tsx` を新規作成
      （Server Component。`?platformId=&patternId=` を `parseUuidParam` で解析し
      Query Service を1回呼ぶ。所属しないIDは先頭にフォールバック）
- [x] **TASK-4.2** `apps/admin/src/features/station-layout/components/StationLayoutView.tsx`
      を新規作成（Server Component。`PlatformDiagram` は選択中の1パターンのみ描画するが、
      `computeBounds`/`layoutConcoursePlates`/`layoutFacingBanners` は
      **全パターン**から算出する。パターン切替のたびに図がスケールし直さないため。
      `apps/web` の `PlatformDisplay.tsx` の合成ロジックを踏襲）
- [x] **TASK-4.3** `apps/admin/public/icons/` を新設し web の6アイコンPNGをコピー
- [x] **TASK-4.4** `apps/admin/src/app/layout.tsx` に BIZ UDPGothic フォントと
      `@furatora/platform-diagram/styles.css` の import を追加
- [x] **TASK-4.5** `apps/admin/package.json` に `@furatora/platform-diagram: workspace:*` を追加
- [x] **TASK-4.6** `di.ts` に `stationLayoutPageQuery` を配線
- [x] **TASK-4.7**（計画時に追加。当初のタスク分解には無かった）
      **PR1のCSS回帰を修正**: `packages/platform-diagram` の Tailwind ユーティリティ
      （`rounded-3xl` 等）が Tailwind v4 の自動ソース検出（`apps/web` / `apps/admin`
      起点で走り `packages/` に届かない）により生成CSSに含まれていなかった
      （実測: PR1後のビルド済みCSSに `rounded-3xl` が0件、PR1前は1件）。
      `apps/web/src/app/globals.css`（PR1ブランチへ追加コミット）と
      `apps/admin/src/app/globals.css`（本PR）の両方に `@source` を追加して解消。
      package README に利用側の必須手順として明記し、ADR-0010「影響」節の
      誤記も合わせて訂正した

### Phase 5: PR2 検証

- [x] `pnpm run typecheck` / `lint` / `test`（リポジトリ全体）→ 全パッケージでエラー0、
      admin 333件 / platform-diagram 154件 / web 13件、すべて pass
- [x] `pnpm run build`（リポジトリ全体）→ web・admin ともに成功。
      両方の生成CSSに `rounded-3xl` が含まれることを確認（TASK-4.7の検証）
- [x] **Neon `development` への直接SQL照合は実施しなかった**: MCPの認証情報
      （org_id）がこのセッションから取得できず、かつ read-only 設定のため
      代替不可。代わりに手動確認で実データとの整合を確認した（下記）
- [x] Playwright で `/stations/{id}/layout` の描画を確認: `apps/admin/e2e/station-layout.spec.ts`
      を新規作成（3件、既存の `stations-list.spec.ts` と同じく実DB依存）。
      ホームタブ切替でURLが変わること、不正なUUIDで500にならず先頭にフォールバック
      すること、存在しない駅IDで404になることを検証。既存24スペックに回帰なし
      （`operators.spec.ts` の1件失敗は本PRと無関係の既存問題。「表示優先度」
      フィールドに関するもので、operator関連ファイルは本PRで未変更）
- [x] **対面乗り換え駅（赤坂見附・表参道）は実データを持たなかった**: 手動確認の結果、
      Neon development の両駅（銀座線・丸ノ内線の赤坂見附）とも `platforms` が
      0件だった（`facilities/page.tsx` でも同じ結果を確認し、クエリ側のバグでない
      ことを確認済み）。design.md が予告した「facilityConnections 0件」以前に、
      ホーム自体が未登録だった。**design.md「手動検証計画」の前提が実データと
      乖離している**ため、代わりに実際に停車パターンを持つ駅（渋谷・東京メトロ
      銀座線1番線、`platforms.physicalLength` は元々未入力）で確認した:
      一時的にホーム長200m・停車パターン（銀座線6両・50〜170m）を登録し、
      図（号車・ドア位置・フリースペース詳細・優先席カード）が web と同じ
      スタイルで描画されることを確認。停車パターンは確認後に削除したが、
      **ホーム長200mは削除できずに残っている**（`PlatformForm` のスキーマが
      `z.number().positive()` で0を拒否するため、UIから未入力状態には戻せない。
      MCPが read-only のためSQLでも戻せない。開発者が db:studio 等で
      手動リセットするか、テスト用の値として残すかを判断すること）

### PR2 レビュー指摘の修正

修正は admin の本PR範囲のみ。web・既存 admin ページの同種の問題は別 Issue に切り出した。

- [x] **ホーム長0・停車パターン無しで位置未登録の一覧と備考が消える**:
      `StationLayoutView` の図の部分だけを `DiagramOrMessage` に分け、早期 return が
      図にしか効かないようにした（web の `PlatformDisplay.tsx` と同じ構成。TASK-4.2 の不一致の解消）。
      `StationLayoutView.test.tsx` を新規作成（2件）
- [x] **サイン書体 BIZ UDPGothic が当たらない**: `--font-sign` は `:root` で宣言され、中の
      `var(--font-biz-udpgothic)` も `:root` で解決される。変数クラスが `<body>` にあったため
      `--font-sign` 全体が無効値になっていた（開発者が DevTools の Rendered Fonts で確認済み）。
      admin の `layout.tsx` で変数クラスを `<html>` へ移した。
      web 側と package の `styles.css` のコメント・README は **#107** に切り出した
- [x] **`stationId` が UUID 検証されず不正パスで500**: `layout/page.tsx` の先頭で
      `parseUuidParam(stationId)` が偽なら `notFound()`。e2e に1件追加。
      `facilities/page.tsx` など他の動的ルート（Page 18件・Route Handler 19件）は **#108** に切り出した
- [x] 検証: admin の `typecheck` / `lint` はエラー0。`test` は335件 pass（新規2件を含む）。
      e2e の `station-layout.spec.ts` は5件 pass（新規1件を含む）
- [x] `docs/domain/` の確認: 書体・パスパラメータ検証・位置未登録一覧の表示はいずれも
      ドメインルールではなく、該当する記述も無いため変更なし

---

## PR3: 図上編集

- [x] **設計訂正**: `PUT platform-locations` は全置換のため、往復に必要なフィールド
      （`platformLocations.notes`/`stationFacilities.notes`/`platformLocationCells.id`/
      `facilityConnections.connectedStationId,connectedPlatformId,directionId`）が
      既存DTOに欠けていると判明。`ports.ts` に交差型（`LayoutFacilityDTO` 等）を追加し、
      `stationLayoutPageQuery.ts` で供給する形で解決（design.md「データフロー」参照）
- [x] **バグ修正（実装時に発見）**: `facilitySchema` が `isWheelchairAccessible`/
      `isStrollerAccessible` に `null` を許さず、`platformLocationRepository` が
      `?? true` で埋めていたため、全置換PUTで座標だけ動かす保存でも未設定(null)が
      アクセシブル(true)に黙って書き換わる不具合があった。スキーマを `.nullable()` に
      広げ、repositoryの判定を「省略(undefined)時のみtrueを補う」に変更して修正
- [x] **設計訂正**: bounds凍結は「ドラッグ開始時に固定しドロップ後に再計算」ではなく
      「保存成功時（baseline更新時）にのみ再計算」に変更（design.md「編集レイヤの
      座標変換」参照。素直に実装するとドロップ直後に図が暴れるため）
- [x] **設計訂正**: 縦方向(y)は割合で取れないと判明。x は `xFraction()*100%`、
      y は `getBoundingClientRect()` の実測値から算出する非対称構成にした
      （design.md・`docs/domain/platform-coordinate-system.md`「編集レイヤ」参照）
- [x] **決定事項（開発者確認済み）**: 号車境界は隣接号車を連動させ
      `cars[i].endMeters === cars[i+1].startMeters` を常に保つ（重なり・隙間を
      物理的に作れないようにする、この計画で確定した恒久ドメインルール。
      `docs/domain/train-stop-patterns.md`「隣接号車は境界を共有する」参照）
- [x] **TASK-6.1** `packages/platform-diagram/src/domain/snap.ts` を新規作成:
      `pxToMeters` / `snapMeters` / `roundToDecimal2` / `snapCandidates`
      （実装時に追加。自己吸着防止の`exclude`引数を持つ）
- [x] **TASK-6.2** `snap.test.ts` を新規作成（26テスト）: グリッド丸め／号車境界スナップ／
      ドア中心スナップ／許容範囲外／Alt解除相当（スナップ無効時）／負座標／範囲外
- [x] **TASK-7.0**（計画時に追加）`apps/admin/src/features/station-layout/ports.ts` /
      `stationLayoutPageQuery.ts` を編集専用フィールドで拡張
- [x] **TASK-7.0b**（計画時に追加）`packages/platform-diagram/src/components/PlatformDiagram.tsx`
      に `diagramOverlay?: (rows: VerticalLayout) => ReactNode` を追加。SVGを`relative`で
      ラップしその中に絶対配置で重ねる。web は未指定のため挙動不変
- [x] **TASK-7.0c**（計画時に追加）`apps/admin/src/features/station-layout/domain/editDraft.ts`
      を新規作成: draft操作（`moveCell`/`moveCarBoundary`/`moveCarEdge`）と
      全置換PUTへのペイロード組み立て（`toPlatformLocationPayload`/`toStopPatternPayload`）
      を純関数化。22テスト
- [x] **TASK-7.1** `apps/admin/src/features/station-layout/components/StationLayoutEditor.tsx`
      を新規作成（`'use client'`。未保存stateの保持、ホーム/パターン切替時の確認モーダル、
      `beforeunload`）
- [x] **TASK-7.2** `apps/admin/src/features/station-layout/components/DiagramEditLayer.tsx`
      を新規作成（`xFraction()` で位置合わせしたポインタイベントハンドル。
      bounds凍結、Alt/Meta検出、スナップ候補の算出）
- [x] **TASK-8.1** アクセス点ドラッグの保存を実装
      （`PUT /api/stations/{sid}/platform-locations/{lid}` を呼ぶ）
- [x] **TASK-8.2** 号車境界ドラッグの保存を実装
      （`PUT /api/stations/{sid}/train-stop-patterns/{pid}` を呼ぶ）
- [x] **TASK-8.3** 未保存バッジ・編集パネルを実装。**設計訂正**: 保存成功時にサーバーへ
      送った値をそのままbaselineへ取り込む方式にしたため（design.md参照）、
      `(concourseId, xPositionMeters)` による選択復元は不要になった（同一編集セッション内
      ではidが変わらないため選択はそのまま維持される）
- [ ] **未着手（開発者への引き継ぎ事項）**: `trainStopPatternSchema` へのサーバー側 refine
      （隣接号車の境界一致を強制）。既存DBに不連続な編成が無いか、以下のSQLで確認してから
      追加すること（MCPが`org_id`を要求し本セッションから実行できなかった）:
      ```sql
      SELECT p.id AS pattern_id, s.name AS station, pl.platform_number, t.name AS train,
             a.car_number AS car_a, a.end_meters, b.car_number AS car_b, b.start_meters,
             (b.start_meters - a.end_meters) AS gap
      FROM train_stop_pattern_cars a
      JOIN train_stop_pattern_cars b
        ON b.train_stop_pattern_id = a.train_stop_pattern_id AND b.car_number = a.car_number + 1
      JOIN train_stop_patterns p ON p.id = a.train_stop_pattern_id
      JOIN platforms pl ON pl.id = p.platform_id
      JOIN stations s ON s.id = pl.station_id
      JOIN trains t ON t.id = p.train_id
      WHERE ABS(b.start_meters - a.end_meters) > 0.01
      ORDER BY s.name, pl.platform_number, a.car_number;
      ```
      0件なら refine をそのまま追加してよい。不連続なペアがあれば、意図的な隙間か
      入力ミスかを確認してから判断する

### Phase 9: PR3 検証

- [x] `pnpm run typecheck` / `lint` / `test`（admin / packages/platform-diagram）→
      全パッケージでエラー0。admin 379件（editDraft 22件・DiagramEditLayer 12件・
      StationLayoutEditor 11件・facility/schema.test.ts の追加1件を含む）/
      platform-diagram 182件（snap.test.ts 26件を含む）、すべて pass
- [x] `pnpm --filter @furatora/admin build` / `pnpm --filter @furatora/frontend build` →
      両方成功。web の挙動不変（`diagramOverlay` 追加の影響）を確認
- [x] RTL で pointer イベントによるドラッグをシミュレートするテストを追加
      （`DiagramEditLayer.test.tsx` 12件、`StationLayoutEditor.test.tsx` 11件。
      jsdomの`getBoundingClientRect`スタブ、bounds凍結の回帰テスト、
      保存fetchのURL・method・ボディ全体の検証を含む）
- [ ] **未実施（開発者への引き継ぎ事項）**: 保存後に DB の値が期待どおりか SQL で確認。
      PR2の記録のとおり、赤坂見附・表参道は`platforms`が0件、渋谷の一時停車パターンは
      削除済みのため、**ドラッグ可能な要素を持つ駅が実DBに存在しない可能性が高い**。
      渋谷（東京メトロ銀座線1番線、`physicalLength=200`が残っている）に停車パターンを
      1件作るなどの前処理が必要
- [ ] **未実施（開発者への引き継ぎ事項）**: `e2e/station-layout.spec.ts` へのドラッグ系
      E2E追加。上記の実データ前提が整ってから着手すること

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
