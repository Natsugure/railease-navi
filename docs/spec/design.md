# 設計: 駅の設備編集を図ベースの単一ページに統合する (Issue #95)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md) /
  ADR-0001 / ADR-0002 / ADR-0003 / ADR-0005 / ADR-0006 / ADR-0009 /
  [ADR-0010](../adr/0010-platform-diagram-package-edit-layer.md)
- **作成日**: 2026-09-11

## 適応的実行戦略

信頼度70%（中）。PoC/MVP を優先する。PR1（パッケージ切り出し）とPR2（読み取り専用の
統合ページ）を先に完成・検証し、そこで得られた実データ描画の確認を土台にPR3（図上編集）
に進む。PR3 自体が本アプリで前例のないドラッグ編集の新規実装であるため、PR3 着手前に
本ファイルの「編集レイヤの座標変換」節を実装しながら再検証する。

## PR 構成

```
PR1: 仕様整備 + ADR-0010 + packages/platform-diagram 新設（web 移行、挙動不変）
  └─ PR2: 読み取り専用の統合ページ（Query Service + 図表示のみ）
      └─ PR3: アクセス点・停車位置の図上編集（ドラッグ + スナップ + 保存）
          └─ PR4: テキストフォーム統合 / 複製フロー刷新(#31) / 路線自動設定(#32①) / #51 見える化
              └─ PR5: 旧ルート削除・リダイレクト / docs/domain 更新 / legacyExclusions 解消
```

**PR1 を独立させる理由**: パッケージ切り出しは挙動不変のリファクタなので、web が
壊れていないことだけで検証が完結する。図編集の設計と混ざらない。

## 全体アーキテクチャ（PR1時点）

```
apps/web/src/features/platform/          apps/admin/src/features/station-layout/（PR2以降）
  components/PlatformDisplay.tsx           ports.ts
  components/PlatformTabs.tsx              components/StationLayoutEditor.tsx  ('use client')
        │  （web固有。パッケージ化しない）  components/DiagramEditLayer.tsx     (PR3)
        │                                   components/inspector/*.tsx          (PR4)
        └──────────────┬────────────────────────────┘
                        ▼
             packages/platform-diagram
               src/domain/    geometry / lanes / consist / doorOrder /
                              concourse / concourseLayout / types / snap(PR3で追加)
               src/components/ PlatformDiagram / DiagramSvg /
                               ConcoursePlateRow / FacingTransferBannerRow
               src/styles.css  --sign-* 等のトークン（解決済みの値。web の primitive
                               scale には依存しない自己完結パッケージ）
```

**依存の向き**: `apps/*/features/*` → `packages/platform-diagram`。パッケージは
Next.js にも `@furatora/database` にも依存しない。

### パッケージの公開面（package.json exports）

```json
{
  "name": "@furatora/platform-diagram",
  "exports": {
    "./domain": "./src/domain/index.ts",
    "./components": "./src/components/index.ts",
    "./styles.css": "./src/styles.css"
  }
}
```

`@furatora/database` の `exports` 方式（コンパイル済みJSを持たず raw .ts をそのまま
公開する）を踏襲する。Next.js の既定のワークスペース解決で動くため、明示的な
`transpilePackages` は不要と見込むが、PR1 の検証で client component（PR3以降で
`'use client'` の編集レイヤから import される）のバンドルに問題が出た場合は
`next.config.ts` を新設して `transpilePackages: ['@furatora/platform-diagram']` を足す
（`apps/web` `apps/admin` は現在 `next.config.ts` を持たず Next.js の既定設定のみで
動いている）。

### CSS の取り込み方

`styles.css` は Mantine の `@mantine/core/styles.css` と同じ形（layout.tsx での
JS import）で取り込む。CSS の `@import` ではなく JS 側 import にするのは、
このリポジトリで既に動作実績のある方法だから。

```ts
// apps/web/src/app/layout.tsx / apps/admin/src/app/layout.tsx
import '@furatora/platform-diagram/styles.css';
```

`styles.css` のトークンは web の `globals.css` にある `--gray-*` 等の primitive scale を
参照せず、**解決済みの具体値**で定義する（下記「移設対象のCSS変数」）。これにより
admin が web の primitive scale 全体（orange/red/green 等、図に無関係な色）を
取り込む必要がなくなる。

### 移設対象のCSS変数（`packages/platform-diagram/src/styles.css`）

| 変数 | 現在の定義（`apps/web/src/app/globals.css`） | 移設後の値 |
|---|---|---|
| `--color-bg-card` | `var(--gray-0)` | `#FFFFFF` |
| `--color-border-default` | `var(--gray-200)` | `#E0E0E0` |
| `--color-border-strong` | `var(--gray-300)` | `#CCCCCC` |
| `--color-text-primary` | `var(--gray-800)` | `#222222` |
| `--color-text-secondary` | `var(--gray-600)` | `#666666` |
| `--color-train-car-bg` | `#D6D3D1`（直値） | 同じ |
| `--color-train-car-border` | `#A8A29E`（直値） | 同じ |
| `--color-car-number-bg` | `rgba(255,255,255,0.9)`（直値） | 同じ |
| `--color-free-standard` | `var(--blue-500)` | `#4072B3` |
| `--color-free-standard-text` | `var(--gray-0)` | `#FFFFFF` |
| `--color-free-nonstandard` | `var(--blue-200)` | `#A5C0E6` |
| `--color-free-nonstandard-text` | `var(--blue-800)` | `#1A2D4E` |
| `--sign-exit-bg` | `#FFD400`（直値） | 同じ |
| `--sign-exit-ink` | `#111111`（直値） | 同じ |
| `--sign-exit-edge` | `#C99A00`（直値） | 同じ |
| `--sign-transfer-bg` | `var(--gray-0)` | `#FFFFFF` |
| `--sign-transfer-edge` | `#111111`（直値） | 同じ |
| `--sign-transfer-ink` | `var(--color-text-primary)` | `#222222` |
| `--sign-transfer-note` | `var(--color-text-secondary)` | `#666666` |
| `--sign-boarding-mark` | `var(--gray-400)` | `#AAAAAA` |
| `--sign-leader` | `var(--gray-400)` | `#AAAAAA` |
| `--card-transfer-bg` | `var(--color-primary-subtle)` | `#EBF1FA` |
| `--card-transfer-border` | `var(--color-primary)` | `#4072B3` |
| `--card-transfer-heading` | `var(--color-primary-text)` | `#264370` |
| `--card-prio-bg` | `var(--color-warning-subtle)` | `#FFF8E1` |
| `--card-prio-border` | `var(--color-warning-muted)` | `#FFE082` |
| `--card-prio-heading` | `var(--color-warning-text)` | `#FFB300` |
| `--font-sign` | `var(--font-biz-udpgothic), "BIZ UDPGothic", ...` | 変更なし（フォント変数名は両アプリで揃える） |

**`apps/web/src/app/globals.css` からは削除しない。** 上表のうち
`--color-bg-card` / `--color-border-default` / `--color-border-strong` /
`--color-text-primary` / `--color-text-secondary` の5つは、当初 platform 図専用と
見立てていたが、実際は `@theme inline` 経由で `body` の背景色・文字色
（`--color-foreground` 等）にも使われている **web アプリ全体の基盤トークン**だった
（削除すると web 全体の見た目が壊れる）。値が完全に一致する解決済みコピーを
パッケージの `styles.css` にも持たせるだけに留め、web 側の定義は一切変更しない
（web は `styles.css` を import する必要も無い。既存の定義で完結している）。
これはPR1着手前の設計時点では platform 専用と誤って見積もっていた点で、
実装時にCSS変数の実使用箇所を確認して修正した。

パッケージの `styles.css` を実際に import して恩恵を受けるのは **admin のみ**（PR2）。
web 固有の primitive scale（`--gray-*` 等）自体は web に残す（`PlatformDisplay.tsx` 等、
パッケージ化しない web 固有コンポーネントが今後も使うため）。

### フォント（`--font-sign`）

`apps/admin/src/app/layout.tsx` に `next/font/google` の `BIZ_UDPGothic` を追加し、
`variable: '--font-biz-udpgothic'` を `body` の `className` に適用する（web の
`layout.tsx` と同じパターン）。

### アイコン（`/icons/*.png`）

`DiagramSvg` の `FACILITY_ICONS` は絶対パス `/icons/elevator.png` 等を直書きしている。
**`iconBasePath` prop を新設**し、既定値 `/icons` を渡せば web は無変更で動く。
admin は `apps/admin/public/icons/` を新設し web の6ファイル（elevator / escalator /
stairs / wheelchair_ramp / stair_lift / wheelchair）をコピーする（`public/` は
アプリごとに独立して配信されるため、パッケージからは配信できず複製が必要。
パッケージ README に複製元・複製理由を明記する）。

```tsx
// packages/platform-diagram/src/components/diagram/DiagramSvg.tsx
type Props = {
  // ...
  /** 設備アイコンPNGの配信元パス。既定 '/icons'（各アプリの public/icons/ を指す） */
  iconBasePath?: string;
};
```

## Server / Client 境界（PR2以降）

- `app/stations/[stationId]/layout/page.tsx` は Server Component。
  `stationLayoutPageQuery.getContext(stationId, { platformId, patternId })` を1本だけ呼ぶ
- 図・編集レイヤ・インスペクタは1つの Client Component ツリー
  （`StationLayoutEditor`、PR3で新設）。DTO は props で渡し、関数は渡さない
  （#94 design.md「Server Component → Client Component の関数 props 制約」と同じ理由）
- ホームタブ・停車パターン切替は `router.push` で URL を更新し Server が再取得する
- ADR-0010「却下した選択肢」参照: ADR-0006 が却下した「Client 化して実測」は
  **表示のためだけに**境界を持ち込むことへの却下であり、編集ビューがポインタ操作を
  必要とすることとは別の理由に基づく

### URL 契約（PR2以降、ADR-0009に倣う）

```
/stations/[stationId]/layout?platformId=&patternId=
```

| クエリ | 意味 | 未指定時 |
|---|---|---|
| `platformId` | 選択中のホームタブ | 表示順の先頭のホーム |
| `patternId` | 図に重ねる停車位置パターン | そのホームの先頭のパターン |

選択中の要素（アクセス点など）は URL に載せない。保存のたびに `platformLocationCells.id`
が変わる（全置換書き込みのため）ため、クライアント state で持つ。

## データフロー（PR2、`stationLayoutPageQuery`）

```ts
// apps/admin/src/features/station-layout/ports.ts
export type StationLayoutContext = {
  stationName: string;
  platforms: LayoutPlatformDTO[];        // タブ用の軽量情報（全ホーム）
  platform: LayoutPlatformDetailDTO;     // 選択中のホーム1本の全データ
  lines: LineWithDirections[];           // 選択肢。サーバーが完全にネストして渡す（#49方式）
  facilityTypes: FacilityTypeOption[];
  connectedStations: ConnectedStationOption[];
  trains: TrainOption[];
};

export interface StationLayoutPageQuery {
  // 駅が無ければ null（ページは notFound() する）
  getContext(
    stationId: string,
    selection: { platformId?: string; patternId?: string },
  ): Promise<StationLayoutContext | null>;
}
```

`LayoutPlatformDetailDTO` は `packages/platform-diagram` の `PlatformDTO`（`domain/types.ts`）
と同じ形を土台に、編集専用フィールド（`platformLocationCells.id` 等、パッケージの
純粋な表示DTOには不要なID群）を追加したもの。`decimal` → `number` の変換は
`external/query/stationLayoutPageQuery.ts` の中で行う（既存規約）。

現在 `facilities/page.tsx`（312行）が `db` を直接 import して7本のクエリを直書きして
いるのを、この1本に集約する。`eslint.config.mjs` の `legacyExclusions` から
`facilities/page.tsx` を PR5 で削除する。

## 編集レイヤの座標変換（PR3）

パッケージの図の上に、`xFraction()` で位置合わせした絶対配置のハンドルを重ねる。
SVG のピクセル座標には触らない（層をまたぐ x は必ず割合で取る、というADR-0006の規約）。

px→m の逆変換は現在存在しないため新規実装する。

```ts
// packages/platform-diagram/src/domain/snap.ts
export function pxToMeters(px: number, bounds: Bounds, canvasWidthPx: number): number;

export function snapMeters(
  raw: number,
  candidates: number[],           // 号車境界 / ドア中心 / 0 / physicalLength
  opts: { gridMeters: number; toleranceMeters: number },
): number;

export function roundToDecimal2(x: number): number;
```

- スナップ候補: `doorCentersX()`（既存）の全ドア中心、各号車の `startMeters`/`endMeters`、
  `0`、`physicalLength`
- 許容範囲 0.4m（= 2px @ 5px/m）以内なら候補に吸着。外れていれば 0.5m グリッドへ丸める
- Alt 押下中はスナップを解除し `roundToDecimal2` のみ適用
- すべて純関数。Vitest でグリッド／号車境界／ドア中心／許容範囲外／負座標／範囲外の
  各ケースをテストする

**bounds の凍結**: `computeBounds()` は全座標から算出するため、要素を右へドラッグすると
bounds が広がって図全体がスケールし直し、ドラッグが暴れる。ドラッグ開始時の bounds を
`DiagramEditLayer` の state に固定し、ドロップ後に再計算する。

**範囲外・負座標**: `platform-coordinate-system.md`「バリデーションで範囲を制限しない」を
守る。`[0, physicalLength]` の外へドラッグできるようにし、警告もブロックもしない。

## 保存（PR3〜PR4）

新しい API ルートは作らない。

| 操作 | エンドポイント |
|---|---|
| コンコース更新 | `PUT /api/stations/{sid}/platform-locations/{lid}` |
| コンコース新規 | `POST /api/stations/{sid}/platform-locations` |
| ホーム基本情報 | `POST` / `PUT /api/stations/{sid}/platforms[/{pid}]` |
| 停車パターン | `POST` / `PUT /api/stations/{sid}/train-stop-patterns[/{pid}]` |
| 各削除 | 既存の `DELETE` |

- ドラッグ結果はクライアント state に溜め、対象アグリゲートに「●未保存」バッジを出す
- 保存は該当アグリゲートのみ。「すべて保存」ボタンは作らない（複数アグリゲートの
  逐次保存は原子的でなく、1ボタンで見せると誤った保証になる）
- ホームタブ切替・パターン切替・ページ離脱時に未保存があれば Mantine の `Modal` で確認
- 保存後は `platformLocationCells.id` が変わる（全置換書き込み）ため、選択状態は
  `(concourseId, xPositionMeters)` で復元する。復元できなければ選択を解除する

**複製フロー（#31、PR4）**: 既存 `POST .../duplicate` は使わない。クライアント側で
コンコースをコピーし「未保存の新規コンコース」として図に出し、x をずらしてから
`POST` で保存する。`duplicate` エンドポイントと `FacilityDuplicateButton` は
PR5（旧ルート削除）で一緒に削除する。

## 座標を持たない要素（#51 見える化、PR4）

図の下に専用セクションを置き、`xPositionMeters === null` のアクセス点を持つコンコースを
列挙する。「位置を入力」ボタンで図の中央付近に仮置きし選択状態にする（未保存）。

## エラーハンドリング

| ケース | 挙動 |
|---|---|
| `platformId` / `patternId` が UUID 形式でない、または当該駅に属さない | 表示順の先頭にフォールバック（500にしない。#94の `parseUuidParam` と同じ思想） |
| 保存中に 409（`DuplicateStopPatternError` 等） | 既存 `TrainStopPatternForm.tsx` と同じ文言でメッセージ表示 |
| 保存中に 404（駅スコープ外） | Mantine notification でエラー表示、ページはリロードしない |
| ドラッグ座標が `[0, physicalLength]` の外 | ブロックしない（仕様） |
| 未保存のままホームタブ・パターン切替 | 確認モーダルを出す |

## ユニットテスト戦略

- `packages/platform-diagram/src/domain/*.test.ts`: 既存6ファイルをそのまま移設
  （154テスト、挙動不変）
- `packages/platform-diagram/src/domain/snap.test.ts`（PR3新規）: グリッド丸め／
  号車境界スナップ／ドア中心スナップ／許容範囲外／Alt解除／負座標／範囲外の各ケース
- `apps/admin/src/features/station-layout/ports.ts` 等の Query Service はユニットテスト
  対象外（既存方針を踏襲。実データ直接SQL検証 + Playwright E2Eでカバー）
- `DiagramEditLayer.tsx` はドラッグの pointer イベントを RTL でシミュレートする
  （PR3で新規のテスト観点。既存 admin に前例が無いため、最初のドラッグ系 Client
  Component テストになる）

## 手動検証計画

PR2 の時点で、対面乗り換えを持つ駅（赤坂見附・表参道）を確認する。ただし
`docs/domain/station-master-model.md` 記載のとおり `facilityConnections` は
実データ0件（#84で粒度見直し中）のため、乗換プレートが表示されないことをもって
正常とする。

## ドキュメント更新（PR5 / Phase 7）

- `docs/domain/platform-coordinate-system.md`: 冒頭の「E2E検証未完了」注記を除去
  （#43はCLOSED済みで事実と乖離している）。「レイヤ構成」に編集レイヤを追記
- `docs/domain/train-stop-patterns.md`: 同じく「E2E検証未完了」注記を除去
- `docs/adr/0010-*.md`: 実装・検証通過後に `Proposed` → `Accepted` を判断（ユーザー承認後）
- `apps/admin/eslint.config.mjs`: `legacyExclusions` から `facilities/page.tsx` ほか
  旧ルート関連ファイルを除去
