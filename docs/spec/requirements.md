# 要件: 駅の設備編集を図ベースの単一ページに統合する (Issue #95)

## 概要

- **対象**: `apps/admin`、`apps/web`（図コードの切り出し元）、新設 `packages/platform-diagram`
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) /
  [ADR-0001](../adr/0001-layer-structure.md) / [ADR-0002](../adr/0002-dependency-inversion-ports.md) /
  [ADR-0003](../adr/0003-read-write-separation.md) / [ADR-0005](../adr/0005-write-atomicity-driver.md) /
  [ADR-0006](../adr/0006-diagram-text-in-html-overlay.md) / [ADR-0009](../adr/0009-list-query-server-side-scoping.md) /
  [ADR-0010](../adr/0010-platform-diagram-package-edit-layer.md) /
  [docs/domain/platform-coordinate-system.md](../domain/platform-coordinate-system.md) /
  [docs/domain/train-stop-patterns.md](../domain/train-stop-patterns.md)
- **作成日**: 2026-09-11
- **ブランチ**: `feature/issue95-phase0-spec`（PR1）以降、子ブランチをスタック
- **信頼度**: 70%（中）— 座標系・保存対象テーブル・既存 API は実測済みで確定しているが、
  ドラッグ編集のインタラクション（スナップ・bounds凍結・未保存状態の扱い）は本アプリで
  前例が無い新規実装であり、実装しながら調整が生じる可能性が高い。PR1（パッケージ切り出し）
  は挙動不変のリファクタで信頼度が高いが、PR3（図上編集）が全体の信頼度を引き下げている。

## 背景

1駅の設備を編集するのに、現状は以下を行き来する（最大5階層）。

- `/stations/[stationId]/edit` — 駅基本情報（`StationEditForm`）
- `/stations/[stationId]/facilities` — 設備場所とホームのハブ一覧（`db` を直接 import する
  312行の未移行 Server Component。`eslint.config.mjs` の `legacyExclusions` に残る）
- `/stations/[stationId]/facilities/[locationId]/edit` — 設備場所（`FacilityForm`）
- `/stations/[stationId]/platforms/[platformId]/edit` — ホーム（`PlatformForm`）
- `/stations/[stationId]/platforms/[platformId]/stop-patterns/[patternId]/edit` — 停車位置
  （`TrainStopPatternForm`）

設備・停車位置・アクセス点はすべて `docs/domain/platform-coordinate-system.md` の
共通のメートル1次元座標系に乗っているが、編集画面ではすべて数値・テキスト入力であり、
相互の位置関係が一切見えない。「このエレベーターは何号車のドア付近か」を確認する手段が無い。

`apps/web` には ADR-0006 で確立した SVG + HTML オーバーレイのホーム図が実装済みで、
`apps/web/src/features/platform/domain/` の8ファイル（`geometry.ts` / `lanes.ts` /
`consist.ts` / `doorOrder.ts` / `concourse.ts` / `concourseLayout.ts` / `types.ts` および
バレル相当）は Next.js 非依存の純関数（154テスト付き）になっている。前提条件だった #43
（メートル座標化の E2E 検証）は 2026-09-08 に CLOSED 済みで着手可能。

## スコープ

### やること

- web の図コード（domain 純関数8ファイル + `PlatformDiagram` / `DiagramSvg` /
  `ConcoursePlateRow` / `FacingTransferBannerRow`）を `packages/platform-diagram` へ
  切り出す（PR1、挙動不変）
- admin に、ホームタブ→ホーム基本情報→図→インスペクタ→座標なし要素、の縦1カラムで
  1駅の設備編集を完結させる単一ページ（`/stations/[stationId]/layout`）を新設する
- アクセス点（`platformLocationCells.xPositionMeters`）・停車位置
  （`trainStopPatternCars.startMeters`/`endMeters`）を図上のドラッグで編集できるようにする
  （0.5m グリッド + 号車境界・ドア中心へのスナップ、Alt でスナップ解除）
- 座標を持たないコンコース（`xPositionMeters === null`）を図の下に明示し、位置入力の
  導線を出す（#51 の「見える化」）
- コンコースの複製をその場でのコピー＆微調整に刷新する（#31 吸収）
- ホーム追加時に路線を自動設定する（#32① 吸収）
- 旧5ルートを廃止し、`/facilities` を新ページへリダイレクトする

### やらないこと（別 Issue へ）

- 駅の基本情報編集（`StationEditForm`）をこのページに含めない。リンクのみ置く
- `platformLocationCells.xPositionMeters` の `NOT NULL` 化（#51）。図で見える化する
  だけで、スキーマ変更・データ棚卸しは #51 に残す
- ホーム位置の基準を列車基準に変更すること（#32③）。#29 のメートル座標化で
  「x=0 はホームの物理的な一端、原点は列車データから導出しない」が確定済みのため、
  前提が失われた項目として取り下げる
- 「x=0 側がどの方面か」を持つ列の追加。図の両端メートルラベルのみで対応する
- 楽観ロック・同時編集制御の導入。保存境界を現行と同じ（アグリゲート単位）に保つため
  衝突範囲は悪化しない
- `platformLocationRepository` の全置換（delete→insert）を部分更新へ改める改修。
  別 Issue として起票を検討する（tasks.md 参照）
- ダッシュボード整理（#93）、一覧の刷新（#94、完了済み）

## 既存パターンの踏襲（新規性を持ち込まない）

| 層 | 既存のお手本 |
|---|---|
| Query Service（`Promise.all` で独立クエリを並列化、`null` で notFound 相当を表現） | `stationListPageQuery.ts`（#94）、`facilityEditPageQuery.ts` |
| Server Component props でフォーム選択肢を供給する（クライアント fetch を新設しない） | `PlatformForm.tsx` が受け取る `LineWithDirections` |
| N+1 解消（`inArray` + アプリ側 Map 畳み込み） | `facilityEditPageQuery.ts` |
| URL 状態方式（選択中のホーム・パターンをクエリで保持） | ADR-0009、`shared/list/` |
| Server → Client への関数 props 制約への対処（データ props + Client 側で組み立て） | `SortableTh.tsx` / `ListPagination.tsx`（#94 design.md） |
| 「プレビュー + 個別上書き」の入力モデル | `buildCarSegments()`（`stop-pattern/domain/carSegments.ts`） |
| 既存 API ルート（`PUT platform-locations/{id}` 等）をそのまま保存先に使う | ADR-0005 のトランザクション境界、既存 `route.test.ts` 資産 |

## 追加しないもの

- 新規 API ルート・新規 Repository メソッド。既存の `PUT`/`POST`/`DELETE` をそのまま使う
- 「すべて保存」ボタン（複数アグリゲートの逐次保存は原子的でなく、単一ボタンは
  誤った保証になる）
- サーバー側フォントメトリクス測定・`useLayoutEffect` による実測レイアウト
  （ADR-0006 が却下した理由は表示のためだけの境界導入であり、編集ビューには当たらないが、
  編集レイヤ自体は `xFraction()` の割合ベースの絶対配置に留め、SVG 側の再実装はしない）
- 汎用の座標変換ライブラリ・ドラッグ&ドロップ用の外部パッケージ（`snap.ts` は純関数で
  自前実装する。5px/m・0.5mグリッドという本アプリ固有の丸めロジックのため）

## ユーザーストーリーと受け入れ基準（EARS記法）

### US-1: 1駅の設備を1ページで見渡す

**管理者が駅の設備レイアウトページを開いたとき、システムはホームタブ・ホーム基本情報・
ホーム図・座標を持たない要素の一覧を1ページに表示すること。**

- 受け入れ基準:
  - `/stations/[stationId]/layout` を開くと、当該駅のホーム一覧がタブとして表示される
  - `?platformId=` 未指定時は表示順の先頭のホームが選択される
  - 選択中のホームの図（停車位置1パターンを重ねたもの）と、座標を持たないアクセス点の
    一覧が同一画面に表示される
  - 旧ルート（`/facilities`、`/facilities/*/edit`、`/platforms/*/edit`、
    `/platforms/*/stop-patterns/*`）は削除され、`/facilities` は新ページへ
    リダイレクトする

### US-2: 図上でアクセス点の位置をドラッグして直す

**管理者が図上のアクセス点アイコンをドラッグしたとき、システムはドラッグ位置を
0.5m グリッドまたは号車境界・ドア中心にスナップし、確定前は「未保存」として
視覚的に区別すること。**

- 受け入れ基準:
  - ドラッグ中の x はポインタ位置から `pxToMeters()` で算出され、既定では
    0.5m グリッドまたは許容範囲 0.4m 以内の号車境界・ドア中心・`0`・`physicalLength`
    にスナップする
  - Alt キー押下中はスナップを無効化し、`decimal(6,2)` の丸めのみ適用する
  - ドラッグ開始時点の描画範囲（bounds）を固定し、ドラッグ中に図全体が
    スケールし直さないこと
  - `[0, physicalLength]` の範囲外・負の座標へのドラッグを許容し、警告やブロックを
    行わないこと（`docs/domain/platform-coordinate-system.md`「座標の範囲」）
  - 保存前はそのコンコースに「●未保存」バッジが表示され、保存すると消える
  - 保存は既存 `PUT /api/stations/{sid}/platform-locations/{lid}` をそのまま呼ぶ

### US-3: 図上で停車位置を追加・調整する

**管理者が列車を選び編成の基準位置を入力したとき、システムは `buildCarSegments()` の
プレビューをそのまま図に重ねて表示し、以後は号車境界のドラッグで個別調整できること。**

- 受け入れ基準:
  - 列車選択 + 「編成の x=0 に近い側の端の位置」+「x=0 に近い側が1号車か最終号車か」の
    入力で、号車ごとの `startMeters`/`endMeters` プレビューが図に重なって表示される
  - 号車境界を個別にドラッグして上書きできる
  - 保存すると `startMeters`/`endMeters` の確定値のみが保存され、算出パラメータは
    保持されない（既存 `buildCarSegments()` の仕様を継承）

### US-4: 座標を持たない要素が見える

**アクセス点の `xPositionMeters` が未入力のとき、システムはそのコンコースを
図の下に警告として明示し、位置入力の導線を提示すること。**

- 受け入れ基準:
  - `xPositionMeters === null` のアクセス点を持つコンコースが専用セクションに列挙される
  - 「位置を入力」を押すと図の中央付近に未保存で仮置きされ、選択状態になる
  - 入力漏れなのか本来位置を持たない設備なのかを、このセクションの存在自体では
    区別しない（区別には #51 のスキーマ変更が必要であることを明記するのみ）

### US-5: コンコースをその場で複製する

**管理者が図上でコンコースの複製を操作したとき、システムは複製をその場で
未保存の新規コンコースとして図に表示し、ページ遷移を発生させないこと。**

- 受け入れ基準:
  - 複製操作は既存の `POST .../duplicate` エンドポイントを呼ばない。クライアント側で
    コンコースをコピーし、x をずらして未保存状態で図に追加する
  - 複製後、一覧に戻ることなくその場で編集し `POST /api/stations/{sid}/platform-locations`
    で保存できる
  - 一覧表示（もしあれば）で「アクセス制限あり」バッジを表示しない

### US-6: ホーム追加時に路線が自動設定される

**管理者が新しいホームを追加するとき、システムは当該駅に紐づく路線を自動設定し、
選択操作を不要にすること。**

- 受け入れ基準:
  - `stationLines` から一意に定まる路線がある場合、ホーム追加フォームの路線欄に
    初期値として設定される
  - 複数路線が候補になる場合は選択を求める（自動設定できない場合のフォールバック）

## 決定事項（本Issueの設計フェーズで確定。恒久知識は docs/domain へ Phase 7 で移送）

- **保存単位はアグリゲート単位**（コンコース1件 / 停車パターン1件 / ホーム基本情報）。
  現行 UI も「1フォーム = 1コンコース」であり衝突範囲が悪化しない
- **図コードは `packages/platform-diagram` に切り出し**、admin は編集レイヤを
  オーバーレイする。管理者が編集中に見る図と公開後の図を完全一致させる
- **px→m の逆変換・スナップ・bounds凍結は新規実装**（`packages/platform-diagram/src/domain/snap.ts`）
- **新しい API ルートは作らない**。既存の `PUT`/`POST`/`DELETE` をそのまま保存先に使う

## 制約

- `<svg>` に明示的な `height`（`h-*` を含む）を指定しない（ADR-0006 の不変条件）
- キャンバスは `width` ではなく `min-width`。祖先の flex アイテムに `min-w-0` が要る
- `stripOrder` の順にそのまま描く。`column-reverse` で再解釈しない
- side 依存の判断は `layoutRows()` に一本化する
- `decimal` → `number` の変換は `external/query/` の中で行い、DTO より上に `string` を
  渡さない（既存規約）
- ADR-0001 の feature 間依存表には `facility` が含まれていない。`station-layout` feature の
  依存はADR-0010で新規に宣言する（既存 ADR-0001 の本文は書き換えない）

## スコープ外（再掲）

- 駅基本情報編集の統合、#51 のスキーマ変更、#32③、x=0側の方面列、楽観ロック、
  全置換書き込みの部分更新化、#93、#94（完了済み）
