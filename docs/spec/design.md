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

**Tailwind の `@source` が別途必須（PR2で判明した回帰への対処）**: `styles.css` の
JS import だけでは `PlatformDiagram` 等が使う Tailwind ユーティリティ（`rounded-3xl`
等）は生成されない。Tailwind v4 の自動ソース検出は利用側アプリ（`apps/web` /
`apps/admin`）を起点に走り、`packages/` 配下までは辿らないため。各アプリの
`globals.css` に以下を追加する必要がある（`@import "tailwindcss";` の直後）:

```css
@source "../../../../packages/platform-diagram/src";
```

この抜けはPR1で発生し、web 側で `rounded-3xl` 等が生成CSSから欠落する回帰と
なっていた（PR1マージ後・PR2着手時に発覚。PR1ブランチへの追加コミットで修正済み）。

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
| `platformId` | 選択中のホームタブ | 表示順の先頭のホーム（`platformNumber` 昇順。`platforms` に表示順カラムが無いため） |
| `patternId` | 図に重ねる停車位置パターン | そのホームの先頭のパターン（`trains.carCount` 昇順 → `trains.name` 昇順 →
`trainStopPatterns.id` 昇順。`trainStopPatterns` に表示順カラムが無く、PR2で新規に決定した） |

選択中の要素（アクセス点など）は URL に載せない。保存のたびに `platformLocationCells.id`
が変わる（全置換書き込みのため）ため、クライアント state で持つ。

## データフロー（PR2、`stationLayoutPageQuery`）

**PR2 実装時の訂正**: 当初この節は `lines` / `facilityTypes` / `connectedStations` /
`trains` を含む形で構想していたが、これらは PR4（テキストフォーム統合）のインスペクタが
必要とする選択肢データであり、読み取り専用の PR2 では使わない。YAGNI に従い PR2 の
実装では持たせず、PR4 着手時に `ports.ts` へ追加する。実際の PR2 実装は以下（PR4 で
追加するフィールドはコメントで示す）:

```ts
// apps/admin/src/features/station-layout/ports.ts
export type StationLayoutContext = {
  stationName: string;
  platforms: LayoutPlatformDTO[];        // タブ用の軽量情報（全ホーム）
  platform: LayoutPlatformDetailDTO | null; // 選択中のホーム1本の全データ。ホーム0件なら null
  // PR4 で追加: lines / facilityTypes / connectedStations / trains（インスペクタの選択肢）
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
と同じ形を土台に、`stopPatterns` を `LayoutStopPatternDTO`（`patternId` 付き）に置き換え、
`selectedPatternId` を追加したもの。`decimal` → `number` の変換は
`external/query/stationLayoutPageQuery.ts` の中で行う（既存規約）。

**PR3実装時に追加した編集専用フィールド**: `PUT /api/stations/{sid}/platform-locations/{lid}`
はコンコース全体を delete→insert する全置換のため、アクセス点を1つ動かすだけでも
コンコース全体のペイロードが必要になる。往復に足りなかったフィールドを
`ports.ts` の交差型（`LayoutFacilityDTO`/`LayoutCellDTO`/`LayoutConnectionDTO`/
`LayoutConcourseDTO`）として追加した:

- `platformLocations.notes`・`stationFacilities.notes`（欠けると全置換で消える）
- `platformLocationCells.id`（draftのキー・React key。APIへは送らない）
- `facilityConnections.connectedStationId`/`connectedPlatformId`/`directionId`
  （欠けると connections を再送できず、省略時に乗換情報が delete のみされる）

`packages/platform-diagram` の `types.ts` には足さない。`apps/web` の
`stationDetailQuery` にも供給義務が生じ、パッケージが編集用フィールドを
抱え込むことになる（ADR-0010「レビュー」節）。

現在 `facilities/page.tsx`（312行）が `db` を直接 import してクエリを直書きしている
のを、この1本に集約する。**実カウントの訂正**: 「7本」は概算で、実際は8箇所
（うち路線解決がホームの路線数ぶん往復する N+1）。列車系5テーブル
（`trainStopPatterns`/`trainStopPatternCars`/`trains`/`trainCarStructures`/
`trainEquipments`）は元々取得していなかったため新規追加。
`eslint.config.mjs` の `legacyExclusions` から `facilities/page.tsx` を PR5 で削除する。

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

// 実装時に追加（tasks.md 参照）。号車境界をドラッグするとき、その境界自身の
// 座標を候補から除かないと必ず元の位置に吸い付いて動かせなくなるため
export function snapCandidates(
  cars: Pick<StopPatternCarDTO, 'startMeters' | 'endMeters' | 'doorCount'>[],
  physicalLength: number,
  options?: { exclude?: number[] },
): number[];
```

- スナップ候補: `doorCentersX()`（既存）の全ドア中心、各号車の `startMeters`/`endMeters`、
  `0`、`physicalLength`
- 許容範囲 0.4m（= 2px @ 5px/m）以内なら候補に吸着。外れていれば 0.5m グリッドへ丸める
- Alt（または Meta）押下中はスナップを解除し `roundToDecimal2` のみ適用
- すべて純関数。Vitest でグリッド／号車境界／ドア中心／許容範囲外／負座標／範囲外の
  各ケースをテストする

**bounds の凍結（実装時に訂正）**: `computeBounds()` は全座標から算出するため、要素を
右へドラッグすると bounds が広がって図全体がスケールし直し、ドラッグが暴れる。
当初「ドラッグ開始時の bounds を固定し、ドロップ後に再計算する」という設計だったが、
素直に実装すると壊れる: bounds が変わると `viewBox` とキャンバスの `min-width` が
同時に変わるため、pointerup の瞬間に図全体がスケールし直し横スクロール位置まで飛ぶ。
「ドラッグ中は暴れない」が「離した瞬間に暴れる」に置き換わるだけになる。

代わりに **保存（`router.refresh()` を伴う保存成功）を境に凍結する**。
`StationLayoutEditor` は「保存が確定した値（baseline）」と「未保存のドラッグ中の値
（draft）」を分けて state に持ち、`computeBounds()` は baseline からのみ算出する。
baseline は編集セッションの開始時（マウント）と、保存成功のたびに（そのアグリゲート分だけ）
更新される。draft がいくら動いても baseline は変わらないため、bounds は自動的に
「保存後にだけ再計算される」。

**縦方向（y）は割合で取れない（実装時に判明）**: `preserveAspectRatio="xMidYMid meet"` は
要素ボックスが viewBox より高いとき幅律速のスケールになり、x は正しいまま y だけ
`(要素の高さ − viewHeight × scale) / 2` ずれる。x はキャンバス実測幅から
`xFraction() * 100%` で取れるが、**y は `getBoundingClientRect()` の実測値から
都度計算する**（`docs/domain/platform-coordinate-system.md`「編集レイヤ」参照）。

**範囲外・負座標**: `platform-coordinate-system.md`「バリデーションで範囲を制限しない」を
守る。`[0, physicalLength]` の外へドラッグできるようにし、警告もブロックもしない
（ただし凍結 bounds の外までは出られない。`computeBounds()` は常に `MARGIN_METERS`
ぶんの余白を持つため、これは実用上の制約にならない）。

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
- ホームタブ切替・パターン切替・ページ離脱時に未保存があれば Mantine の `Modal` で確認。
  **実装時の制約**: App Router に公式のルート遷移ブロックが無いため、このモーダルで
  止められるのは `StationLayoutEditor` 自身が持つタブと `beforeunload`（リロード・
  タブ閉じ）のみ。`AdminShell` のグローバルナビ等、他経路からの離脱は止められない
- 保存後は `platformLocationCells.id` が変わる（全置換書き込み）が、**実装時に単純化**:
  `StationLayoutEditor` は保存に成功したアグリゲートについて、サーバーへ実際に送った
  値をそのまま baseline へ取り込む（`router.refresh()` の到着を待たない）。
  id はサーバー側で再生成されるが、その id は API 送信にも UI のキーにも使うだけで
  保存結果の正しさには影響しないため、同一編集セッション内では元の（stale な）id を
  保持したまま使い続けてよい。したがって「`(concourseId, xPositionMeters)` による
  選択復元」は不要になった（選択は同一セッション内で id が変わらないため、そのまま
  維持される。id が変わるのはページの再マウント時のみで、そのときは選択状態も
  最初から無い）

**号車の重なり・隙間を作らない（PR3実装時に確定した恒久ルール）**: 号車境界を
ドラッグしたとき、隣接号車の `endMeters`/`startMeters` を常に同値に保つ
（`apps/admin/src/features/station-layout/domain/editDraft.ts` の `moveCarBoundary`）。
重なり・隙間は物理的に起こり得ないため、編集側で構造的に作れないようにする
（`docs/domain/train-stop-patterns.md`「隣接号車は境界を共有する」）。
サーバー側スキーマでの強制は、既存データの連続性を確認してから別途追加する
（未確認。tasks.md 参照）。

**US-3 の実装範囲（PR3 / PR4 の分割、実装時に明確化）**: US-3 の受け入れ基準のうち
「列車選択＋編成基準位置入力で `buildCarSegments()` のプレビューを重ねる」はインスペクタ
（テキストフォーム統合）の一部であり PR4 の対象。PR3 が実装するのは「号車境界を
個別にドラッグして上書きできる」「保存すると確定値のみが保存される」の2点のみ。

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
- `packages/platform-diagram/src/domain/snap.test.ts`（PR3新規、26テスト）: グリッド丸め／
  号車境界スナップ／ドア中心スナップ／許容範囲外／Alt解除／負座標／範囲外／
  `snapCandidates` の各ケース
- `apps/admin/src/features/station-layout/domain/editDraft.test.ts`（PR3実装時に追加、
  22テスト）: draft 操作（`moveCell`/`moveCarBoundary`/`moveCarEdge`）と、
  全置換PUTへのペイロード組み立て（`toPlatformLocationPayload`/`toStopPatternPayload`）。
  往復に必要な全フィールド（notes・facility.notes・connections）が保持されることを
  ここで固定する。`'use client'` に依存しない純関数なので node 環境でテストできる
- `apps/admin/src/features/station-layout/ports.ts` 等の Query Service はユニットテスト
  対象外（既存方針を踏襲。実データ直接SQL検証 + Playwright E2Eでカバー）
- `DiagramEditLayer.test.tsx`（PR3実装時に追加、12テスト）: ドラッグの pointer イベントを
  RTL でシミュレートする（既存 admin に前例が無いため、最初のドラッグ系 Client
  Component テストになった）。jsdom の `Element.prototype.getBoundingClientRect` を
  スタブしてキャンバス実測を再現する
- `StationLayoutEditor.test.tsx`（PR3実装時に追加、11テスト）: ドラッグ→未保存バッジ→
  保存の一連の流れ。保存 fetch のURL・method・ボディ全体の検証、bounds凍結の回帰
  （`<svg>` の `viewBox` がドラッグ中に変化しないこと）、404エラー通知、未保存タブ
  遷移の確認モーダル、`beforeunload` を含む

## 手動検証計画

PR2 の時点で、対面乗り換えを持つ駅（赤坂見附・表参道）を確認する計画だった。ただし
`docs/domain/station-master-model.md` 記載のとおり `facilityConnections` は
実データ0件（#84で粒度見直し中）のため、乗換プレートが表示されないことをもって
正常とする、としていた。

**PR2実装時の訂正**: Neon development で実際に確認したところ、両駅（銀座線・
丸ノ内線の赤坂見附）とも `platforms` が0件（ホーム自体が未登録）だった。
`facilityConnections` 以前の問題であり、この計画の前提が実データと乖離していた。
代わりに実際にホーム・停車パターンを持つ駅（渋谷・東京メトロ銀座線）で、一時的に
ホーム長・停車パターンを登録して図の描画を確認した（tasks.md Phase 5 参照）。

## ドキュメント更新（PR5 / Phase 7）

- `docs/domain/platform-coordinate-system.md`: 冒頭の「E2E検証未完了」注記を除去
  （#43はCLOSED済みで事実と乖離している）。「レイヤ構成」に編集レイヤを追記
- `docs/domain/train-stop-patterns.md`: 同じく「E2E検証未完了」注記を除去
- `docs/adr/0010-*.md`: 実装・検証通過後に `Proposed` → `Accepted` を判断（ユーザー承認後）
- `apps/admin/eslint.config.mjs`: `legacyExclusions` から `facilities/page.tsx` ほか
  旧ルート関連ファイルを除去
