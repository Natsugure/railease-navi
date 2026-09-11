# ADR-0010: ホーム図を packages に切り出し、閲覧は Server Component・編集は Client Component で層を分ける

- **ステータス**: Proposed
- **日付**: 2026-09-11
- **決定者**: @Natsugure
- **関連**: [ADR-0001](./0001-layer-structure.md), [ADR-0006](./0006-diagram-text-in-html-overlay.md),
  [`docs/domain/platform-coordinate-system.md`](../domain/platform-coordinate-system.md)

---

## コンテキストと課題

Issue #95 は、admin の駅設備編集（現状5階層に分散）を、web に実装済みのホーム図
（ADR-0006）を使った単一ページに統合する。ここで2つの決定が必要になる。

### 課題1: 図のコードを admin にどう持ち込むか

`apps/web/src/features/platform/domain/` の8ファイルは Next.js 非依存の純関数
（154テスト付き）で、描画コンポーネント（`PlatformDiagram` / `DiagramSvg` /
`ConcoursePlateRow` / `FacingTransferBannerRow`）も `next/*` を一切importしていない。
一方で描画は Tailwind クラス・web固有のCSS変数（`--sign-*` 等）・
`apps/web/public/icons/*.png` に依存しており、admin にはこれらが存在しない。

admin は編集中に図を表示するだけでなく、その図の上にドラッグ可能なハンドルを
重ねる必要がある。管理者が編集中に見る図が、保存後に公開される図と異なっていては、
「図を見ながら直す」という Issue #95 の狙いが成立しない。

### 課題2: 編集ビューの Server/Client 境界

ADR-0006 は「Client Component にして `useLayoutEffect` で実測し、SVG を再レイアウトする」
案を却下している。却下理由は「Server Component 既定という方針を崩す」「初回描画の
ちらつきとハイドレーション境界を、**表示のためだけに**持ち込むことになる」というもので、
実測はブラウザのCSSに任せれば済むという判断だった。

Issue #95 の編集ビューはドラッグというポインタ操作を必須とするため、Client Component
にならざるを得ない。これは ADR-0006 の却下理由と同じ理由で却下されるべきものか、
それとも別の話か、切り分けが必要。

## 決定

### 決定1: `packages/platform-diagram` に切り出す

図の domain 純関数と描画コンポーネントを新設パッケージ `packages/platform-diagram` に
移し、`apps/web` と `apps/admin` の両方がそこから import する。web は現状の見た目を
維持したまま参照先を変えるだけ（挙動不変のリファクタ）。admin は同じコンポーネントの
上に、独自の編集レイヤ（ポインタイベントハンドル）を `xFraction()` の割合で
位置合わせしてオーバーレイする。

これにより、管理者が編集中に見る図と公開後の図が同一のコードパスで描画される。
web固有のCSS変数は、パッケージの `styles.css` に解決済みの具体値として複製し、
web の primitive scale（`--gray-*` 等）には依存しない自己完結パッケージにする。
アイコンPNGは `public/` がアプリごとに独立配信されるため複製が必要（`iconBasePath`
propで配信元を注入可能にする）。

### 決定2: 編集ビューは Client Component とし、ADR-0006 の却下理由とは別の話として扱う

ADR-0006 が却下したのは「表示のためだけに」Client化することであり、
「操作が要求するので Client化する」こととは動機が異なる。編集ビューは Client
Component にする。ただし ADR-0006 が確立した不変条件（`xFraction()` による層間の
座標対応、SVGへの `height` 非指定、`stripOrder` の一貫描画）はすべて維持する。
編集レイヤは SVGの再レイアウトを行わず、既存の描画結果の上に絶対配置のハンドルを
重ねるだけに留める。

### 決定3: feature間依存の宣言

`apps/admin` に新設する `features/station-layout` は `facility` / `platform` /
`stop-pattern` の3featureに依存する。ADR-0001 の feature間依存表（`platform` /
`station` / `stop-pattern` の組み合わせのみを許可）には `facility` が含まれていない。
ADR-0001 の本文は書き換えず（Accepted/Proposedを問わず既存ADRの本文は書き換えない
運用のため）、本ADRで `station-layout → facility, platform, stop-pattern` を追加で
宣言する。

なお、この feature間依存ルールは現時点で ESLint による機械的強制の対象外である
（`packages/eslint-config/next-app.mjs` はレイヤー間の import 制限のみを強制しており、
feature間の組み合わせまでは強制していない）。本ADRはドキュメント上の規約として
明文化するに留まる。

## 却下した選択肢

### admin に丸ごとコピーする

domain・コンポーネントの両方を admin へ複製する。最も低コストだが、
**二重管理になり、管理者が見る図と公開図がじれる**。スキーマ変更のたびに
2箇所を直す必要があり、ADR-0001 が解決しようとした「同じ概念が複数箇所に
分散する」問題を再導入する。

### domain 純関数だけ共有し、SVG は admin 専用に書き下ろす

`geometry.ts` 等の計算だけをパッケージ化し、描画は admin が Mantine の色で
独自に実装する。CSS変数・アイコンの移植が不要になる利点はあるが、
「編集画面で公開図と同じものを見る」という Issue #95 の狙いそのものが崩れる。
将来 web の図が変わるたびに admin 側の見た目が追随しないリスクも残る。

### 図も Server Component のまま保ち、編集操作は別UIで行う（ADR-0006の一貫性を優先）

ADR-0006 の「Server Component 既定」を崩さない案。座標編集を数値入力や
モーダルのドラッグ以外の手段（キーボード操作等）に限定すれば実現できなくはないが、
**Issue #95 の目的（図を見ながら直感的に操作する）そのものを放棄することになる**。
ADR-0006 の却下理由は「表示のためだけに」境界を持ち込むことへの却下であり、
操作要件から生じる Client化とは前提が異なるため、この案は採らない。

## 影響

- `apps/web/src/features/platform/domain/` と一部 `components/` が
  `packages/platform-diagram` へ移動する。web 側の import パスが変わる
  （挙動は変わらない）
- 移設対象のCSS変数のうち5つ（`--color-bg-card` 等）は、実装時の確認により
  `@theme inline` 経由で web 全体の基盤トークンでもあると判明したため、
  `apps/web/src/app/globals.css` からは削除しない。パッケージの `styles.css` には
  値が完全に一致する解決済みコピーを持たせる（両方に存在する状態で確定）
- `apps/admin` に `public/icons/` と BIZ UDPGothic フォントが新設される
- `apps/admin` に `features/station-layout` が新設され、feature間依存の
  実質的な組み合わせが1つ増える（ADR-0001 の依存表に対する追加宣言）

## レビュー

`packages/platform-diagram` が編集専用の複雑さ（ドラッグ・スナップ・未保存state）を
抱え込み、web が使わない大量のコードを importしているとみなされる状態になったとき
再評価する。その場合も本決定を覆すのではなく、編集専用ロジックを admin 側の
`features/station-layout` に押し戻す（パッケージは表示用の純粋な描画のみに戻す）形を
先に検討する。
