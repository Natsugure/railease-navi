# 設計: admin フォームの props 化と型ルール有効化 (Issue #49 / #50)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md) /
  [ADR-0001](../adr/0001-layer-structure.md) / [ADR-0002](../adr/0002-dependency-inversion-ports.md) /
  [ADR-0003](../adr/0003-read-write-separation.md)
- **作成日**: 2026-09-06

## 適応的実行戦略

信頼度 90%（高）。違反箇所と件数を実測済みで、Query Service の追加は
`external/query/stopPatternPageQuery.ts` + `features/stop-pattern/ports.ts` +
`di.ts` という完成形のお手本がある。PoC は設けず段階的実装に進む。

唯一の未知は「`PlatformForm` が路線＋方面を1ページに載せる形にしたとき、
DTO のサイズが実データで問題ないか」。TASK-1.6 で `db:studio` により
`lines` 62件 / `line_directions` 52件を確認し、問題ないと判断した。

**この判断は PR #90 のレビューで差し戻した。** 実測し直すと `lines` は **602件**
（`line_directions` 50件、うち方面を持つ路線は14件）で、62件という前提が既に
古かった。全路線を返すとホームの新規・編集ページを開くたびに RSC ペイロードへ
602 路線が載る。`PlatformEditPageQuery` は**当該駅の `stationLines` に載る路線
だけ**を返す形に変更した（詳細は下記「路線の絞り込み」）。

## PR 構成

`gh-stack` で2本のスタックPR。

```
main
 └─ feature/issue49-...  (PR1: Issue #49 — props 化 + no-floating-promises を error に)
     └─ feature/issue50-...  (PR2: Issue #50 — noUncheckedIndexedAccess + CI)
```

PR1 が `StationEditForm` / `FacilityForm` を大きく書き換える。PR2 の
`noUncheckedIndexedAccess` 対応（`StationEditForm` の Record→配列化など）を
その上に積むと、同一ファイルへの変更が時系列で分かれて衝突が最小になる。

---

## PR1 アーキテクチャ — Issue #49

### 全体像

```
[管理者] --GET--> 編集/新規ページ (Server Component)
                        |
                        v
                    di.ts （手動配線・ADR-0002）
                        |
                        v
        external/query/*PageQuery.ts  （@furatora/database を import してよい唯一の層）
                        |  implements
                        v
        features/*/ports.ts  （*PageQuery インターフェース + DTO 型）
                        |
                        v
        features/*/components/*Form.tsx  （props で DTO を受け取る。fetch しない）
```

従来の「フォームが `useEffect` で同じサーバーに聞き直す」経路を、
「ページが Query Service を1回呼んで DTO を props で渡す」へ置き換える。

### 追加する ports と Query Service

| feature | ports（新規/追加） | Query Service 実装 |
|---|---|---|
| `train` | `ports.ts`（**新規**） | `external/query/trainEditPageQuery.ts`（新規） |
| `line` | `features/line/ports.ts`（**新規 feature**） | `external/query/lineEditPageQuery.ts`（新規） |
| `station` | `features/station/ports.ts`（**新規 feature**） | `external/query/stationEditPageQuery.ts`（新規） |
| `platform` | `ports.ts`（追加） | `external/query/platformEditPageQuery.ts`（新規） |
| `facility` | `ports.ts`（追加） | `external/query/facilityEditPageQuery.ts`（新規） |

`di.ts` に各実装を1行ずつ配線する。

**`features/line/` と `features/station/` は現在存在しない。** `schema.ts` や
`domain/` は今回作らず、`ports.ts` と（必要なら）`components/` のみを置く。
既存の `train` feature も `ports.ts` が無いので新規作成になる。

### DTO 契約（インターフェース）

すべて JSON シリアライズ可能なプリミティブ・配列・プレーンオブジェクトのみ
（ADR-0003）。`decimal` 列は Query Service 内で `Number()` 済みにして返す。

```ts
// features/line/ports.ts
type OperatorOption = { id: string; name: string };

type LineEditContext = {
  line: {
    name: string; nameKana: string | null; nameEn: string | null;
    odptRailwayId: string | null; slug: string | null; lineCode: string | null;
    color: string | null; displayOrder: number; operatorId: string;
  };
  operators: OperatorOption[];
};

interface LineEditPageQuery {
  getEditContext(lineId: string): Promise<LineEditContext | null>; // null → notFound()
}

// --- 方面 ---
type DirectionStationOption = {
  id: string; name: string; nameEn: string | null; code: string | null;
};

type LineDirectionEditContext = {
  lineName: string;
  stations: DirectionStationOption[]; // その路線の駅（stationOrder 順）
  direction?: {
    id: string; directionType: string; representativeStationId: string;
    displayName: string; displayNameEn: string;
    terminalStationIds: string[] | null; notes: string;
  };
};

interface LineDirectionEditPageQuery {
  getCreateContext(lineId: string): Promise<LineDirectionEditContext | null>;
  getEditContext(lineId: string, directionId: string): Promise<LineDirectionEditContext | null>;
}
```

```ts
// features/station/ports.ts — ConnectionRow は StationEditForm から移設して共用
type StationEditContext = {
  station: { /* 現行 initialData と同じ10フィールド */ };
  operators: OperatorOption[];
  connections: ConnectionRow[]; // 現行の Server Component が組み立てている構造をそのまま
};

interface StationEditPageQuery {
  getEditContext(stationId: string): Promise<StationEditContext | null>;
}
```

```ts
// features/platform/ports.ts に追加 — 方面を路線にネストするのが肝（US-2）
type LineWithDirections = {
  id: string;
  name: string;
  inboundDirections: { id: string; displayName: string }[];
  outboundDirections: { id: string; displayName: string }[];
};

type PlatformEditContext = {
  stationName: string;
  lines: LineWithDirections[];
  platform?: {
    id: string; platformNumber: string; lineId: string;
    inboundDirectionId: string | null; outboundDirectionId: string | null;
    physicalLength: number; platformSide: string | null; notes: string;
  };
};

interface PlatformEditPageQuery {
  getCreateContext(stationId: string): Promise<PlatformEditContext | null>;
  getEditContext(stationId: string, platformId: string): Promise<PlatformEditContext | null>;
}
```

**路線の絞り込み（PR #90 レビュー対応）**

`lines` は `stationLines` を `innerJoin` して**当該駅に紐づく路線だけ**を返す。
方面も同じ `stationLines` サブクエリで絞る。ホームは駅に停車する路線に属する
ものなので、それ以外の路線を選択肢に出す意味がない。実測（渋谷・外苑前・表参道）
で 602路線/50方面 → 1路線/2方面 に縮む。

既存データの安全性は次で確認済み: `stationLines` を持たない駅 0件、
自駅の `stationLines` に無い路線を参照する `platforms` 0件。
副作用として、駅に `stationLines` が1行も無いと路線を選べなくなるため、
`PlatformForm` は `lines.length === 0` のときに理由を示す注記を出す。

```ts
// features/facility/ports.ts に追加 — 接続候補駅にホーム・方面をネスト（US-3、N+1解消）
type ConnectedStationOption = {
  id: string; name: string; code: string | null;
  // 1駅が複数路線を持ち得るので配列（PR #90 レビュー対応）。
  // 単数で持つと JOIN 結果の「駅×路線」粒度がそのまま漏れ、接続候補リストに
  // 同じ駅が並ぶ。両方チェックすると facility_connections の
  // unique(platformLocationId, connectedStationId) に抵触して保存に失敗する。
  // stationLines に unique(stationId) を付けない理由は
  // docs/domain/station-master-model.md「stationLines に unique(stationId) を付けない」
  lines: { id: string; name: string }[];
  platforms: { id: string; platformNumber: string }[];
  directions: { id: string; displayName: string }[];
};

type FacilityEditContext = {
  stationName: string;
  platforms: { id: string; platformNumber: string; physicalLength: string }[];
  facilityTypes: { code: string; name: string }[];
  connectedStations: ConnectedStationOption[];
  location?: LocationData; // 現行 FacilityForm の LocationData と同型
};

interface FacilityEditPageQuery {
  getCreateContext(stationId: string): Promise<FacilityEditContext | null>;
  getEditContext(stationId: string, locationId: string): Promise<FacilityEditContext | null>;
}
```

### Query Service 実装方針

`stationPublishingPageQuery.ts` の「`Promise.all` で複数クエリ → アプリ側で
`Map` に畳んで group by」の書き方に揃える。N+1 は作らない。

- **operators / 路線の駅一覧**: 単純な `select` 1本
- **`LineWithDirections`（platform）**: `lines` を1本、`lineDirections` を
  `inArray(lineDirections.lineId, lineIds)` で1本引き、`directionType` で
  inbound/outbound に振り分けてアプリ側で group by
- **`ConnectedStationOption`（facility）**: 現行 `GET /api/stations?connectedFrom=`
  と同じ JOIN で接続候補駅を取り、その `stationId[]` を使って
  `platforms` と `lineDirections`（`stations/[stationId]/directions` の
  ロジックと同じ：当該駅ホームの in/outboundDirectionId を集めて `inArray`）を
  それぞれ1本ずつ引いて畳む。駅ごとの往復をしない
- 既存の所有権検証（対象ホーム/方面が当該駅・路線のものか）は Query 内に移す。
  該当なしは `null` を返し、ページが `notFound()` する

### フォームの変更（`useEffect` 削除）

| ファイル | 変更 |
|---|---|
| `components/LineForm.tsx` | props に `operators`。`useState<Operator[]>` と `useEffect` 削除 |
| `components/StationEditForm.tsx` | props に `operators`。`useEffect` 削除。`ConnectionRow` 型は `features/station/ports.ts` へ移設し re-export |
| `features/train/components/TrainForm.tsx` | props に `operators` / `lines`。`dataLoading` と `<Loader/>` 早期 return 削除 |
| `components/LineDirectionForm.tsx` | props に `stations`。`loadedLineId` / `stationsLoading` / `useEffect` 削除（レース解消）。`Loader` import も除去 |
| `features/platform/components/PlatformForm.tsx` | props に `lines: LineWithDirections[]`。**`useEffect` 2本と `Promise.resolve().then()` ハック削除**。`inbound/outboundDirections` は `lines.find((l) => l.id === lineId)?.inboundDirections ?? []` の派生値。`linesLoading` 削除 |
| `features/facility/components/FacilityForm.tsx` | props に全データ。**`useEffect`（:111-168）を丸ごと削除**。`connectionRows` は `useState(() => buildRows(props))` の遅延初期化。`connectedStationPlatforms` / `connectedStationDirections` の `Record` state は廃止し、`connectedStations` から直接引く。`dataLoading` 削除 |

親ページ10本を Query Service 呼び出しへ置換。`trains/new/page.tsx` は
同期関数 → `async` 化。全ページで `context == null` → `notFound()`。

### API GET の撤去（US-5）

| 対象 | 操作 |
|---|---|
| `api/facility-types/route.ts` | ファイル削除（GET のみ） |
| `api/lines/route.ts` | ファイル削除（GET のみ） |
| `api/stations/route.ts` | ファイル削除（GET のみ・3分岐すべて呼び出し元消滅） |
| `api/stations/[stationId]/directions/route.ts` | ファイル削除（GET のみ） |
| `api/platforms/route.ts` | ファイル削除（既にデッド。ソースに呼び出し元なし） |
| `api/operators/route.ts` | GET を削除、POST は残す（OperatorForm が使用） |
| `api/lines/[lineId]/directions/route.ts` | GET を削除、POST は残す（LineDirectionForm が使用） |
| `api/stations/[stationId]/platforms/route.ts` | GET を削除、POST は残す（PlatformForm が使用） |
| `api/operators/route.test.ts` | `describe('GET /api/operators')` の2ケースを削除。`import { GET, POST }` を `POST` のみに。POST テストは残す |

### ルール有効化（US-6）

- `packages/eslint-config/next-app.mjs`: `no-floating-promises` を `"error"` に。
  Issue #49 を指すコメント（66-73行）を削除
- `apps/admin/eslint.config.mjs` の `legacyExclusions.files` から以下を削除:
  - 削除した route: `api/stations/route.ts`, `api/stations/[stationId]/directions/route.ts`,
    `api/platforms/route.ts`, `api/facility-types/route.ts`, `api/lines/route.ts`
  - GET 化解消した route: `api/operators/route.ts`（`route.test.ts` は POST が残るため要判断）,
    `api/lines/[lineId]/directions/route.ts`, `api/stations/[stationId]/platforms/route.ts`
  - Query Service 化した親ページ: `lines/[lineId]/edit`, `lines/[lineId]/directions/{new,[directionId]/edit}`,
    `stations/[stationId]/edit`, `stations/[stationId]/platforms/{new,[platformId]/edit}`,
    `stations/[stationId]/facilities/{new,[locationId]/edit}`, `trains/[trainId]/edit`
  - `src/components/StationEditForm.tsx`（`@furatora/database/enums` のみの import になり
    `no-restricted-imports` に当たらなくなる）
- 削除後、`legacyExclusions` に残った各ページ・route が**まだ DB 直 import を
  必要としている**ことを1件ずつ確認する（消しすぎると lint エラーになる）

---

## PR2 アーキテクチャ — Issue #50

`packages/typescript-config/base.json` に `"noUncheckedIndexedAccess": true`。

### 対処方針（箇所ごと）

| ファイル | 件数 | 対処 |
|---|---|---|
| `admin/src/components/StationEditForm.tsx` | 9 | `connectionStates` を `Record<string, ConnectionState>` → `(ConnectionState & { id: string })[]` に変更。`connections` から必ず全キーが揃うので Record の必然性が無い。`updateConnection` は `id` 一致で `map`。`s = connectionStates.find((c) => c.id === conn.id)` にし、レンダー側は `!` ではなく「見つからなければスキップ」で扱う。TS18048 8件 + TS2345 1件が同時に消える |
| `admin/src/features/station-publishing/domain/romaji.ts` | 7 | **ロジック見直し**。促音処理で `kana[i+1]`/`kana[i+2]` を先読み（:126付近）、末尾「ッ」で undefined を踏む。`romaji.test.ts` に末尾「ッ」ケースを追加して現挙動を固定 → 境界を明示的に扱う。`GOJUON[ch]`/`YOUON[x]` の TS2538（undefined をキーにできない）は、キー変数を先に `string` へ絞ってから添字 |
| `admin/src/external/repository/platformLocationRepository.ts` | 6 | `admin/src/external/requireInserted.ts`（新規・小関数）を作り `const [row] = await db...returning()` を `const row = requireInserted(await db...returning())` に。`packages/database` は共有のため触らず admin ローカル |
| `admin/src/app/page.tsx` | 5 | `stationPublishingPageQuery.ts:24` の `Number(row?.count ?? 0)` に揃える |
| `admin/src/app/api/trains/route.ts` | 3 | `const [created] = ...returning()` の後、`requireInserted` で受けるか `if (!created) return 500` |
| `admin/src/external/repository/stopPatternRepository.ts` | 1 | 同上 |
| `web/src/components/TransferDifficultySection.tsx` | 11 | **潜在バグ**。`useState(0)` の index で `connections[selectedIndex]`。`const selected = connections[selectedIndex]; if (!selected) return null;`（またはクランプ）。根本1箇所で11件連動して消える |
| `web/src/features/platform/domain/concourseLayout.ts` | 4 | `:157` `bracketStartX`/`bracketEndX`、`:173-174`。直前に長さガードあり。分割代入デフォルト（`const [a = 0] = xs`）か、ガード直後の非 null が自明な箇所は `!` |
| `web/src/components/OperatorList.tsx` | 1 | `:14` `operators.length === 1 ? operators[0].id : null` → `operators[0]?.id ?? null`（等価） |
| `web` の `concourseLayout.test.ts`(23)/`concourse.test.ts`(5)/`consist.test.ts`(2) | 30 | **全件 `!`**（決定済み）。`groups[0]!.x`、二重添字は `groups[0]!.transfers[0]!.lines`、`consist.test.ts:31` は `centers[0]!` / `centers[centers.length - 1]!`。テスト本文のロジックには手を入れない |

### typecheck スクリプトと CI（US-8）

- `apps/scripts` / `packages/database` の `package.json` に `"typecheck": "tsc --noEmit"`
- `apps/web` / `apps/admin` は **`"typecheck": "next typegen && tsc --noEmit"`**。
  両者の `tsconfig.json` の `include` は `["src", "next-env.d.ts", ".next/types/**/*.ts"]`
  だが、`next-env.d.ts`（`.gitignore:48`）と `.next/`（`.gitignore:20`）は
  いずれも git 管理外である。CI はクリーンチェックアウト後に `build` を挟まないため、
  型生成を前置しないと以下が解決できず必ず失敗する:
  - 静的アセットの import（`next/image-types/global` が `*.svg` `*.png` 等を宣言）
  - Route Handler / Page の props 型（`.next/types/validator.ts`）
  `next typegen`（Next 15.5+）はフルビルドなしにこの2つを生成する。
  **`next-env.d.ts` をコミットする案は採らない**: 中身が `next dev` 後は
  `.next/dev/types/routes.d.ts`、`next typegen` / `next build` 後は `.next/types/routes.d.ts`
  を指すモード依存で、常時 diff ノイズになるうえ、CI には `.next` が無いため
  参照先が解決できず問題が別のエラーに置き換わるだけである
- ルート `package.json`: `"typecheck": "turbo run typecheck"`
- `turbo.json`: `"typecheck": { "dependsOn": ["^typecheck"] }`（`lint` と同形）
- `.github/workflows/ci.yml`（新規）:
  - トリガー `pull_request`（`cleanup-neon-preview.yml` は `pull_request: closed` なので非干渉）
  - `pnpm/action-setup` → `actions/setup-node`（`node-version: 22`, `cache: pnpm`）→
    `pnpm install --frozen-lockfile` → `pnpm run lint` → `pnpm run typecheck` → `pnpm run test`
  - **DB 不要を確認済み**: `DATABASE_URL` を外して `turbo run test` で
    admin 268 + web 167 全通過。route handler テストは `db` をモック

## エラーハンドリング

| ケース | 期待挙動 |
|---|---|
| Query Service が対象を見つけられない | `null` を返し、ページが `notFound()`（現行の `if (!x) notFound()` と同じ） |
| props 化後、選択肢が空 | セレクトは空リストで描画（従来の fetch 失敗時と同じだが、SSR エラーは `error.tsx` が捕捉する） |
| API POST/PUT | 変更しない。既存の 400 / 409 / 500 マッピングを維持 |

## ユニットテスト戦略

- **既存フォームにテストは無い**。今回テストを新設するかは YAGNI 判断：
  props 化で `global.fetch` モックが不要になるため、`DeleteButton.test.tsx` を
  参考に **LineForm / TrainForm の「渡した選択肢が `<option>` として出る」** の
  最小テストを1〜2本足すに留める（回帰の主対象は「初期表示で埋まっている」ため）
- Query Service は `db` 実接続が要るためユニットテストしない（既存 Query Service も
  していない）。E2E も現状これらのフローに無いため、**手動確認が主たる検証**
- `romaji.ts` の変更は `romaji.test.ts` に末尾「ッ」ケースを追加してから直す
- API GET 削除に伴い `api/operators/route.test.ts` の GET ブロックを削除
