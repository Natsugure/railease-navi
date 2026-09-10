# 要件: 駅・路線一覧を事業者スコープ化し、絞り込みと並び替えを追加する (Issue #94)

## 概要

- **対象**: `apps/admin`
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) /
  [ADR-0001](../adr/0001-layer-structure.md) / [ADR-0002](../adr/0002-dependency-inversion-ports.md) /
  [ADR-0003](../adr/0003-read-write-separation.md) / [ADR-0009](../adr/0009-list-query-server-side-scoping.md) /
  [docs/domain/station-master-model.md](../domain/station-master-model.md) /
  [docs/domain/station-visibility.md](../domain/station-visibility.md)
- **作成日**: 2026-09-10
- **ブランチ**: `feature/issue94-list-scoping`
- **信頼度**: 88%（高）— 対象テーブルのスキーマ・索引・実データ分布を実測で確認済み。
  Query Service パターン・URL 状態方式（`stations/[stationId]/connections/new`）の
  既存お手本があり、新しいアーキテクチャ判断は ADR-0009（一覧の絞り込みをサーバー側で
  行う契約）1点のみ。不確実性は「事業者カード一覧」という新規 UI 要素の見た目調整のみ。

## 背景

Admin の駅・路線一覧は全国の全レコードを一括取得していた。

- `apps/admin/src/app/stations/page.tsx`: `stationLines × stations` 10,625行を
  無条件に1本の JOIN で取得し、JS で「事業者 → 路線 → 駅」の3階層に畳んで全描画する。
  LIMIT・スコープ・絞り込み手段が無い。
- `apps/admin/src/app/lines/page.tsx`: 全路線 + 全事業者を取得する。

実運用では特定事業者・特定路線の駅だけを見たいことがほとんどで、
データ量が増えるほど破綻する。実測（2026-09-10, Neon `development`）:
事業者162 / 路線602 / 駅10,625。最大の事業者（JR東日本）だけで86路線・1,961駅。

## スコープ

### やること

- 駅一覧・路線一覧の事業者スコープ化（`?operatorId=&lineId=`）
- スコープ内でのテキスト絞り込み（駅一覧: 駅名 / 英名 / 駅番号。路線一覧: 路線名 /
  路線コード / 事業者名）。検索は事業者未選択でも全国横断で効く
- テーブル列ヘッダのクリックによる並び替え（駅一覧: 駅番号 / 駅名 / 公開状態 / 路線。
  路線一覧: 表示順 / 名称 / コード / 事業者）
- サーバー側ページング（1ページ50件）
- 上記すべての状態を URL クエリに反映し、リロード・共有・戻る操作で復元する
- 駅一覧・路線一覧を Query Service パターン（`features/*/ports.ts` +
  `external/query/*.ts`）へ移行する（`eslint.config.mjs` の `legacyExclusions` から除去）

### やらないこと（別 Issue へ）

- 索引の追加。`docs/domain/station-visibility.md`「この規模では専用索引を置かない」
  方針を維持する
- `/trains` `/operators` 一覧の同様の移行。件数が小さいため対象外（#48 の範囲）
- #48（API GET エンドポイント群の Query Service 化）。本 Issue は一覧ページの
  Query Service 化のみを担当し、両者は並行して着手できる（#48 本文で範囲調整済み）
- `station_lines.station_order` が97%（10,294/10,625）NULL であることの解消
  （データ移行。別 Issue に起票する）
- ダッシュボード整理（#93）、設備編集の図統合（#95）

## 既存パターンの踏襲（新規性を持ち込まない）

| 層 | 既存のお手本 |
|---|---|
| URL 状態方式（スコープをクエリで保持し `router.push` で取り直す） | `stations/[stationId]/connections/new`（`StationConnectionCreateForm.tsx`）。#49 / #88 |
| Query Service（`Promise.all` で独立クエリを並列化、`null` で notFound 相当を表現） | `stationConnectionCreatePageQuery.ts` |
| N+1 解消（`inArray` + アプリ側 Map 畳み込み） | `facilityEditPageQuery.ts` |
| Server Component props でフォーム選択肢を供給する（クライアント fetch を新設しない） | Issue #49 全般 |
| 段階的スコープ（事業者→路線）の port 引数 | `StationConnectionCreatePageQuery.getCreateContext(stationId, scope)` |

## 追加しないもの

- `@tanstack/react-table` / `mantine-datatable`（一覧が2画面のみのため依存を増やさない。
  Issue 本文の推奨どおり自前実装（ソート用の `SortableTh`）を採用）
- 仮想スクロール（サーバー側ページングで代替）
- 汎用の `listQuery(table, params)` ヘルパ（ADR-0009 / ADR-0003「共通化しないこと自体が
  決定事項」）

## ユーザーストーリーと受け入れ基準（EARS記法）

### US-1: 事業者を選んで駅一覧を絞り込む

**管理者が駅一覧で事業者を選択したとき、システムはその事業者に属する駅だけを
ページングして表示すること。**

- 受け入れ基準:
  - `/stations` を事業者・路線・検索語のいずれも未指定で開いたとき、駅一覧・件数の
    クエリが1本も発行されない（事業者選択肢のための集計クエリのみ発行される）
  - 事業者を選ぶと `?operatorId=` が URL に反映され、その事業者の駅が1ページ50件で
    表示される
  - 路線セレクトはその事業者の路線だけに絞られる

### US-2: 路線を選んで駅一覧をさらに絞り込む

**管理者が事業者選択後に路線を選択したとき、システムはその路線の駅だけを
`stationOrder` 相当の順序で表示すること。**

- 受け入れ基準:
  - 路線を選ぶと `&lineId=` が URL に追加され、ページが1に戻る
  - 並び順は `station_lines.station_order`（NULLS LAST）→
    `stations.ekidata_station_cd`（NULLS LAST）→ `stations.id` の順（後述「並び順の
    フォールバック」参照）
  - 路線が確定しているときは「路線」列を隠し、路線見出し（色・名称・駅数）を表示する

### US-3: スコープ内をテキストで絞り込む

**管理者が検索語を入力したとき、システムはスコープ内（未選択なら全国）で
駅名・英名・駅番号（路線一覧では路線名・路線コード・事業者名）の部分一致に
絞り込むこと。**

- 受け入れ基準:
  - 検索語は事業者・路線が未選択でも機能する（全国横断・LIMIT付き）
  - 検索語中の `%` `_` はワイルドカードとして解釈されず、リテラル文字として扱われる
  - 検索語・スコープの変更でページが1に戻る
  - 該当が0件のとき「該当する駅（路線）が見つかりません。」と表示する

### US-4: 列ヘッダで並び替える

**管理者が並び替え可能な列ヘッダをクリックしたとき、システムはその列で
昇順に並び替え、もう一度クリックすると降順に切り替えること。**

- 受け入れ基準:
  - 駅一覧: 駅番号 / 駅名 / 公開状態 / 路線が並び替え可能
  - 路線一覧: 表示順 / 名称 / コード / 事業者が並び替え可能
  - 駅名・路線名の並び替えは `name_kana` を用いる（DB の collation が `C.UTF-8` のため
    `name` では五十音順にならない。後述「並び順のフォールバック」参照）
  - 並び替えでページが1に戻る。既定のソート・順序は URL に出力しない

### US-5: 状態が URL に復元される

**管理者がスコープ・検索語・並び替え・ページを変更した状態でページを
リロードまたは共有したとき、システムは同じ表示を復元すること。**

- 受け入れ基準:
  - すべての状態変更が `router.push` / `router.replace` で URL に反映される
  - リロード・戻る操作で同じ絞り込み・並び替え・ページが再現される
  - 不正な値（存在しない sort キー、UUID でない operatorId、0以下の page 等）は
    500 にならず既定値にフォールバックする

### US-6: 一覧が Query Service パターンに移行している

**開発者が一覧のクエリを変更するとき、システムは `features/*/ports.ts` +
`external/query/*.ts` の既存パターンに従っていること。**

- 受け入れ基準:
  - `apps/admin/src/app/stations/page.tsx` / `lines/page.tsx` が `@/di` 経由で
    Query Service を呼ぶのみで、`@furatora/database` を直接 import しない
  - `apps/admin/eslint.config.mjs` の `legacyExclusions` からこの2ファイルが除かれ、
    `no-restricted-imports` が有効になっている

## 並び順のフォールバック（実測に基づく制約）

実測（2026-09-10, Neon `development`）で判明した既存データの性質により、
素朴な実装では成立しない部分がある。

- **`station_lines.station_order` は10,294/10,625行がNULL**（路線単位でほぼ全か無か:
  全NULL 587路線 / 全設定 14路線 / 部分設定 1路線）。「現行順を維持する」を素直に
  実装すると97%が未定義順になる。`stations.ekidata_station_cd` が路線内の駅順を
  実質的に担っている（山手線で `1130201 大崎 → 1130202 五反田 → …` と確認済み）ため、
  これを次点キーにする
- **DB の collation は `C.UTF-8`**。`ORDER BY stations.name` は漢字のコードポイント順に
  なり五十音順にならない。`stations.name_kana` はNULL 0件（実測）のため、駅名の
  並び替えはこちらを使う。`operators.name` にも同じ制約があるが `operators` に
  `nameKana` 列は無く、既存コード（`stationCreatePageQuery.ts` 等）も `name` で
  ソートしている。本 Issue はこの既存の制約を継承し、新規に解決しない
- **`stations.code` / `stations.name_en` は10,148/10,625行がNULL**（駅ナンバリングを
  ekidata が供給しないため。`docs/domain/station-master-model.md` 記載どおり）。
  ソート・検索キーとして使うが `NULLS LAST` が必須

## 制約

- Mantine の `Table` に組み込みソートは無い。自前実装（`SortableTh`）で対応し、
  新規ライブラリは追加しない
- `shared/` ディレクトリ（ADR-0001 が定義、これまで `.gitkeep` のみ）を
  `shared/list/` として初めて使用する
- Server Component から Client Component へ関数を props として渡せない
  （RSC のシリアライズ制約）。URL 組み立てはデータ props（`current` 状態オブジェクト）
  を渡し、Client Component 側で `buildListHref` を呼ぶ

## スコープ外（再掲）

- 索引追加、`/trains` `/operators` の移行、#48、`station_order` のデータ移行、
  #93、#95
