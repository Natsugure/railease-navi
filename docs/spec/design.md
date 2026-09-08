# 設計: 駅・路線マスタの新規作成手段を Admin に実装する (Issue #88)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md) /
  [ADR-0001](../adr/0001-layer-structure.md) / [ADR-0002](../adr/0002-dependency-inversion-ports.md) /
  [ADR-0003](../adr/0003-read-write-separation.md) / [ADR-0005](../adr/0005-write-atomicity-driver.md) /
  [docs/domain/station-master-model.md](../domain/station-master-model.md)
- **作成日**: 2026-09-08

## 適応的実行戦略

信頼度 90%（高）。新規性のある実装判断を持ち込まず、既存の完成形
（`POST /api/stations/[stationId]/platforms/route.ts` + `features/platform/*` +
`external/repository/platformRepository.ts` + `di.ts`）をそのまま複製する。
PoC は設けず段階的実装に進む。

唯一の未知は「複合ユニーク制約を衝突対象にした `onConflictDoNothing`
（`target: [col1, col2]`）が drizzle-orm 0.45.1 で意図どおり動くか」。
リポジトリ内の既存 `onConflict*` は `seed-master-data.ts` の単一カラム target のみ。
TASK-3.x で `toSQL()` により生成 SQL を確認し、`ON CONFLICT (station_id, connected_station_id)` が
出ることを記録する。

## PR 構成

`gh-stack` で3本のスタック PR。

```
develop
 └─ feature/issue88-...            (PR1: 仕様整備 + 路線の作成)
     └─ feature/issue88-station    (PR2: 駅の作成)
         └─ feature/issue88-conn-adj (PR3: 乗換接続・隣接の作成と削除)
```

分割の根拠: PR1 で作成系の最小の縦切り（schema → ports → repository → route → form → page → di）を
確立し、PR2・PR3 はその形の反復にする。PR3 は `withTransaction` + 複合 `onConflict` +
ドメイン正規化を含み最もリスクが高いため最後に積む。

---

## 全体アーキテクチャ

既存の書き込み経路（`platforms` の POST）と同一。

```
[管理者] --submit--> *CreateForm.tsx (Client Component)
                        |  fetch(POST /api/...)
                        v
                    route.ts  (@furatora/database を import しない。ADR-0001)
                        |  zod safeParse → 400
                        |  @/di 経由で Repository を呼ぶ
                        v
                    di.ts  (手動配線・ADR-0002)
                        |
                        v
        external/repository/*Repository.ts  (@furatora/database を import してよい層)
                        |  implements
                        v
        features/*/ports.ts  (Repository インターフェース + エラークラス。next/* を import しない)
                        |  uses
                        v
        features/*/schema.ts  (zod。z.infer で Input 型を export)
        features/*/domain/*.ts (純粋関数。隣接の昇順正規化)
```

選択肢データ（作成フォームのセレクト）は Server Component が Query Service の
`getCreateContext()` を呼んで props で渡す（`LineDirectionEditPageQuery` に前例）。
クライアント側 `fetch` を新設しない（#49 の方針）。

### 認証

`middleware.ts` の matcher（`'/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)'`）は
新規 `/api/` ルートの POST / DELETE も覆う。未認証は 401。route ハンドラ側に
追加の認可コードは書かない（既存ルートと同じ）。

### エラーハンドリング（既存の写像に揃える）

| ケース | ステータス | 実装 |
|---|---|---|
| 不正 JSON ボディ | 400 | `request.json()` を try/catch（`publication/route.ts` と同じ） |
| zod バリデーション失敗 | 400 | `NextResponse.json({ error: parsed.error.issues }, { status: 400 })` |
| 一意制約違反（冪等 upsert で吸収しきれない場合） | 409 | Repository が `*ConflictError` を throw、route が写像 |
| 隣接の端点が路線に属さない | 422 | `AdjacencyEndpointNotOnLineError` → route が写像 |
| 参照先の駅・路線が存在しない（FK 違反） | 422 | Repository が検証して専用エラー、または 23503 を写像 |
| その他 | 500 | `catch` の最後 |

---

## PR1: 路線の作成

### `features/line/schema.ts`（新規）

```ts
import { z } from 'zod';

export const lineCreateSchema = z.object({
  name: z.string().min(1),
  operatorId: z.string().uuid(),
  nameKana: z.string().nullable().optional(),
  nameEn: z.string().nullable().optional(),
  odptRailwayId: z.string().nullable().optional(),
  lineCode: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  displayOrder: z.number().int().nullable().optional(),
});

export type LineCreateInput = z.infer<typeof lineCreateSchema>;
```

`slug` は含めない（`lines.slug` は公開駅の URL 前提。作成時は NULL でよい。
既存の `PUT /api/lines/[lineId]` で後から設定できる）。`lib/validations.ts` の
`lineUpdateSchema` はコピーせず、feature ローカル規約（`z.infer` export）に従う。

### `features/line/ports.ts`（追記）

```ts
import type { LineCreateInput } from './schema';

export type LineRecord = {
  id: string;
  name: string;
  operatorId: string;
};

export interface LineRepository {
  create(input: LineCreateInput): Promise<LineRecord>;
}
```

`LineEditPageQuery` に `getCreateContext()` を追加:

```ts
export type LineCreateContext = { operators: OperatorOption[] };

export interface LineEditPageQuery {
  getEditContext(lineId: string): Promise<LineEditContext | null>;
  getCreateContext(): Promise<LineCreateContext>;
}
```

### `external/repository/lineRepository.ts`（新規・`db`）

`lines` は単一テーブル単一行のため `withTransaction` 不要（ADR-0005「適用範囲」）。
`platformRepository.ts` の `create` と同型。`ekidataLineCd` / `slug` は設定しない（NULL）。

```ts
export const dbLineRepository: LineRepository = {
  async create(input) {
    const [row] = await db.insert(lines).values({
      name: input.name,
      operatorId: input.operatorId,
      nameKana: input.nameKana ?? null,
      nameEn: input.nameEn ?? null,
      odptRailwayId: input.odptRailwayId ?? null,
      lineCode: input.lineCode ?? null,
      color: input.color ?? null,
      displayOrder: input.displayOrder ?? 0,
    }).returning({ id: lines.id, name: lines.name, operatorId: lines.operatorId });
    return requireInserted(row ? [row] : []);
  },
};
```

### `external/query/lineEditPageQuery.ts`（追記）

`getCreateContext()` は既存の `getOperatorOptions()` を再利用して `{ operators }` を返す。

### `app/api/lines/route.ts`（新規・POST）

`platforms/route.ts` と同型。`@/di` の `lineRepository` を呼ぶ。201 で作成行を返す。

```ts
export async function POST(request: Request) {
  try {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'リクエストボディが不正な JSON です' }, { status: 400 }); }

    const parsed = lineCreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const line = await lineRepository.create(parsed.data);
    return NextResponse.json(line, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### `components/LineForm.tsx`（改修・新規/編集兼用）

`OperatorForm` の `operatorId ? PUT : POST` パターンを踏襲。

- Props: `lineId?: string` / `initialData?: {...}` を任意化。`operators` は必須のまま
- `initialData` 未指定時は各 state を空文字 / 0 で初期化
- `handleSubmit`: `lineId` があれば `PUT /api/lines/${lineId}`、無ければ `POST /api/lines`
- 送信ボタンのラベルは `lineId ? '更新' : '作成'`
- 成功時 `router.push('/lines')` + `router.refresh()`

### `app/lines/new/page.tsx`（新規）

`operators/new/page.tsx` + `trains/new/page.tsx` の折衷。`lineEditPageQuery.getCreateContext()` で
事業者を取り、`<LineForm operators={context.operators} />` を置くだけ。

### `app/lines/page.tsx`（改修）

見出しを `<Group justify="space-between">` にして「+ 新規」（`LinkButton href="/lines/new"`）を追加。
`operators/page.tsx` と同じ形。

### `di.ts`（追記）

```ts
export const lineRepository = dbLineRepository;
```

---

## PR2: 駅の作成

### `features/station/schema.ts`（新規）

```ts
export const stationCreateSchema = z.object({
  name: z.string().min(1),
  operatorId: z.string().uuid(),
  lineId: z.string().uuid(),
  nameKana: z.string().nullable().optional(),
  nameEn: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  lat: z.string().nullable().optional(),
  lon: z.string().nullable().optional(),
  odptStationId: z.string().nullable().optional(),
  prefCode: z.number().int().nullable().optional(),
  stationGroupId: z.string().uuid().nullable().optional(),
  stationOrder: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type StationCreateInput = z.infer<typeof stationCreateSchema>;
```

**`slug` を含めない**（station-master-model.md「slug の導出規則」: インポートでは書かず、
公開操作で管理者が確定する）。`published_requires_slug` の CHECK は
`publishedAt = NULL` により自然に満たされる。`ekidataStationCd` も設定しない。

### `features/station/ports.ts`（追記）

```ts
import type { StationCreateInput } from './schema';

export type StationRecord = { id: string; name: string };

export interface StationRepository {
  create(input: StationCreateInput): Promise<StationRecord>;
}

// 作成フォームの選択肢
export type StationGroupOption = { id: string; name: string; prefCode: number | null };

export type StationCreateContext = {
  operators: OperatorOption[];
  lines: { id: string; name: string; operatorId: string }[];
  // prefCode 指定時のみその都道府県の乗換単位グループ。未指定なら空配列
  stationGroups: StationGroupOption[];
};

export interface StationCreatePageQuery {
  getCreateContext(prefCode?: number): Promise<StationCreateContext>;
}
```

### `external/repository/stationRepository.ts`（新規・`withTransaction`）

`stations` + `stationLines` の2テーブル書き込みのため `withTransaction`（ADR-0005）。
`stationPublishingRepository.ts` の tx 利用形を踏襲。

```ts
export const dbStationRepository: StationRepository = {
  async create(input) {
    return withTransaction(async (tx) => {
      const [station] = await tx.insert(stations).values({
        name: input.name,
        operatorId: input.operatorId,
        nameKana: input.nameKana ?? null,
        nameEn: input.nameEn ?? null,
        code: input.code ?? null,
        lat: input.lat ?? null,
        lon: input.lon ?? null,
        odptStationId: input.odptStationId ?? null,
        prefCode: input.prefCode ?? null,
        stationGroupId: input.stationGroupId ?? null,
        // publishedAt / slug / ekidataStationCd は設定しない（NULL）
      }).returning({ id: stations.id, name: stations.name });
      const created = requireInserted(station ? [station] : []);

      await tx.insert(stationLines).values({
        stationId: created.id,
        lineId: input.lineId,
        stationOrder: input.stationOrder ?? null,
      });

      return created;
    });
  },
};
```

FK 違反（存在しない `operatorId` / `lineId` / `stationGroupId`）は zod を通っても
起こりうる。23503 を検知して 422 に写像する（`isForeignKeyViolation` を
`stationPublishingRepository.ts` の `isUniqueViolation` と同じ `err.cause.code` 方式で実装）。

### `external/query/stationCreatePageQuery.ts`（新規）

- `operators`: 全件（162）。`{ id, name }`
- `lines`: 全件（602）。`{ id, name, operatorId }`。フォーム側で事業者選択に応じて絞る
- `stationGroups`: `prefCode` 未指定なら `[]`。指定時のみ
  `where(eq(stationGroups.prefCode, prefCode))` で返す（8,782件を一度に返さない）

602路線を RSC ペイロードに載せることの是非: `id` / `name` / `operatorId` の3フィールドのみで
約 40KB 程度。`PlatformEditPageQuery` が当初 602 路線を許容していた（後に絞った）水準。
作成ページは頻度が低く、事業者による段階選択で表示は絞るため許容する。

### `components/StationCreateForm.tsx`（新規・軽量）

`StationEditForm` は接続の複数 PUT 分裂を持つため流用しない。新規の軽量フォーム:

- 事業者セレクト → 選択に応じて路線セレクトの選択肢を `lines.filter(l => l.operatorId === operatorId)` で絞る
- 駅名（必須）・よみがな・英語名・駅番号・緯度・経度・ODPT ID・備考・路線内順序
- 都道府県コード（`NumberInput`）→ 変更時に `router.push('/stations/new?prefCode=' + v)` で
  グループ選択肢を RSC 再取得（クライアント `fetch` を新設しない）
- 駅グループセレクト（任意。`prefCode` 未選択時は「先に都道府県を選択」と表示）
- `POST /api/stations` → 成功時 `router.push('/stations')` + `refresh()`

### `app/api/stations/route.ts`（新規・POST）

`platforms/route.ts` と同型。`stationRepository.create()` を呼ぶ。
FK 違反 → 422、その他 → 500。

### `app/stations/new/page.tsx`（新規）

`searchParams` から `prefCode` を読み（`Promise<{ prefCode?: string }>`）、
`stationCreatePageQuery.getCreateContext(prefCode)` を呼ぶ。

### `app/stations/page.tsx`（改修）

見出しに「+ 新規」（`/stations/new`）を追加。

### `di.ts`（追記）

```ts
export const stationRepository = dbStationRepository;
export const stationCreatePageQuery = dbStationCreatePageQuery;
```

### 縮小オプション

`stationGroupId` は現状どの読み取りコードからも参照されていない（FK 定義のみ）。
都道府県スコープのグループ選択 UI が過剰と判断されれば、`stationGroupId` は常に NULL とし、
`prefCode` を `stations.prefCode` の単純入力としてのみ残す。その場合
`stationCreatePageQuery` は `stationGroups` を返さず、フォームからグループセレクトを外す。

---

## PR3: 乗換接続・隣接の作成と削除

### 乗換接続

#### `features/station-connection/schema.ts`（新規）

```ts
export const stationConnectionCreateSchema = z.object({
  connectedStationId: z.string().uuid(),
  strollerDifficulty: z.enum([...]).nullable().optional(),
  wheelchairDifficulty: z.enum([...]).nullable().optional(),
  notesAboutStroller: z.string().nullable().optional(),
  notesAboutWheelchair: z.string().nullable().optional(),
});
```

自己接続の排除は route 側で `parsed.data.connectedStationId === stationId` を見て 400。
（`stationId` は URL パラメータのため schema の `.refine()` に渡せない。）

#### `features/station-connection/ports.ts`（新規）

```ts
export interface StationConnectionRepository {
  // (A→B) と (B→A) を1トランザクションで冪等挿入。source='manual'。
  // 戻り値は作成/既存を問わず成功なら true
  createPair(stationId: string, input: StationConnectionCreateInput): Promise<boolean>;
  // 両方向を削除。1行でも消えれば true
  deletePair(stationId: string, connectedStationId: string): Promise<boolean>;
}

export type ConnectionCandidateStation = {
  id: string; name: string; code: string | null; lineName: string;
};

export type StationConnectionCreateContext = {
  stationName: string;
  operators: { id: string; name: string }[];
  // operatorId 指定時のみ。その事業者の路線
  lines: { id: string; name: string }[];
  // lineId 指定時のみ。その路線の駅（自駅は除外）
  candidates: ConnectionCandidateStation[];
};

export interface StationConnectionCreatePageQuery {
  // stationId が無ければ null
  getCreateContext(
    stationId: string,
    scope: { operatorId?: string; lineId?: string },
  ): Promise<StationConnectionCreateContext | null>;
}
```

#### `external/repository/stationConnectionRepository.ts`（新規・`withTransaction`）

```ts
async createPair(stationId, input) {
  return withTransaction(async (tx) => {
    await tx.insert(stationConnections).values([
      { stationId, connectedStationId: input.connectedStationId, source: 'manual',
        strollerDifficulty: input.strollerDifficulty ?? null, /* ... */ },
      { stationId: input.connectedStationId, connectedStationId: stationId, source: 'manual',
        strollerDifficulty: input.strollerDifficulty ?? null, /* ... */ },
    ]).onConflictDoNothing({
      target: [stationConnections.stationId, stationConnections.connectedStationId],
    });
    return true;
  });
}
```

難易度・備考は両方向に同じ値を入れる（乗り換えの向きで難易度が変わる場合は
既存の `PUT /api/station-connections/[connectionId]` で個別に直す。作成は対称値で足りる）。

`deletePair` は `or(and(stationId=A, connectedStationId=B), and(stationId=B, connectedStationId=A))` で
`db.delete`（単一テーブルだが2行、原子性は1文の DELETE で担保されるため `withTransaction` 不要）。

#### `external/query/stationConnectionCreatePageQuery.ts`（新規）

**全10,625駅を一度に読まない。** 段階的スコープ:

1. `operatorId` 未指定: `operators` 全件のみ返す
2. `operatorId` 指定: その事業者の `lines` を返す
3. `lineId` 指定: `stationLines ⋈ stations` でその路線の駅を返す（`stationOrder` 順、自駅を除外）

#### `app/api/stations/[stationId]/connections/route.ts`（新規・POST）

`createPair` を呼ぶ。冪等なので既存でも 201。自己接続チェック → 400。

#### `app/api/stations/[stationId]/connections/[connectedStationId]/route.ts`（新規・DELETE）

`deletePair(stationId, connectedStationId)`。0行なら 404。

#### `app/stations/[stationId]/connections/new/page.tsx`（新規）

`searchParams` の `operatorId` / `lineId` で `getCreateContext` を呼ぶ。
セレクト変更で `router.push` して URL クエリを更新（#94 の URL 状態方式に揃える）。
相手駅を選んで難易度・備考を入れて `POST`。

#### `components/StationEditForm.tsx`（改修）

- 接続一覧テーブルに「削除」列を追加。各行に
  `<DeleteButton endpoint={`/api/stations/${stationId}/connections/${conn.connectedStationId}`} />`
- 見出しに「接続を追加」（`LinkAnchor href={`/stations/${stationId}/connections/new`}`）
- **既存の保存経路（`handleSave` の PUT fetch 群）は一切変更しない**
- `ConnectionRow` に `connectedStationId: string` を追加（`features/station/ports.ts` /
  `stationEditPageQuery.ts` 側も対応）

`DeleteButton` の `redirectTo` を任意化する（後述）。接続削除は駅編集ページに
留まって一覧更新でよい。

### 隣接

#### `features/station-adjacency/domain/normalize.ts`（新規・純粋関数）+ `.test.ts`

```ts
// unique_station_adjacency (lineId, stationAId, stationBId) は順序依存で逆向きペアを
// 別行として通す。DB 制約では逆向き重複を防げないため、書き込み側が昇順正規化を守る
// （docs/domain/station-master-model.md「隣接」）。
export function normalizeAdjacencyEndpoints(
  x: string, y: string,
): { stationAId: string; stationBId: string } {
  return x <= y
    ? { stationAId: x, stationBId: y }
    : { stationAId: y, stationBId: x };
}
```

UUID は文字列比較で全順序が定まる。テスト: `(a,b)` と `(b,a)` が同じ結果／
`(a,a)` はそのまま返る（自己隣接の排除は schema の責務）。

#### `features/station-adjacency/schema.ts`（新規）

```ts
export const stationAdjacencyCreateSchema = z.object({
  stationAId: z.string().uuid(),
  stationBId: z.string().uuid(),
}).refine((v) => v.stationAId !== v.stationBId, {
  message: '同じ駅どうしを隣接にはできません',
});
```

#### `features/station-adjacency/ports.ts`（新規）

```ts
export class AdjacencyEndpointNotOnLineError extends Error {
  constructor() {
    super('隣接の端点がこの路線に属していません');
    this.name = 'AdjacencyEndpointNotOnLineError';
  }
}

export type AdjacencyRow = {
  id: string;
  stationAId: string; stationAName: string;
  stationBId: string; stationBName: string;
};

export type StationAdjacencyPageContext = {
  lineName: string;
  stations: { id: string; name: string; stationOrder: number | null }[];
  adjacencies: AdjacencyRow[];
};

export interface StationAdjacencyRepository {
  // 端点を昇順正規化し、lineId 所属を検証してから挿入。冪等。
  // 端点が路線に属さなければ AdjacencyEndpointNotOnLineError
  create(lineId: string, stationAId: string, stationBId: string): Promise<void>;
  delete(lineId: string, adjacencyId: string): Promise<boolean>;
}

export interface StationAdjacencyPageQuery {
  getPageContext(lineId: string): Promise<StationAdjacencyPageContext | null>;
}
```

#### `external/repository/stationAdjacencyRepository.ts`（新規・`db`）

```ts
async create(lineId, aId, bId) {
  // lineId 所属の検証（stationLines に両端点があるか）
  const onLine = await db.select({ stationId: stationLines.stationId })
    .from(stationLines)
    .where(and(eq(stationLines.lineId, lineId), inArray(stationLines.stationId, [aId, bId])));
  const ids = new Set(onLine.map((r) => r.stationId));
  if (!ids.has(aId) || !ids.has(bId)) throw new AdjacencyEndpointNotOnLineError();

  const { stationAId, stationBId } = normalizeAdjacencyEndpoints(aId, bId);
  await db.insert(stationAdjacencies)
    .values({ lineId, stationAId, stationBId })
    .onConflictDoNothing({
      target: [stationAdjacencies.lineId, stationAdjacencies.stationAId, stationAdjacencies.stationBId],
    });
}
```

単一テーブル単一行のため `withTransaction` 不要（検証 SELECT と INSERT の間の
競合は `onConflictDoNothing` が吸収する）。

#### `external/query/stationAdjacencyPageQuery.ts`（新規）

`lines.name` + その路線の駅（`stationLines ⋈ stations`、`stationOrder` 順）+
既存の `stationAdjacencies` 行（両端点の駅名を JOIN で解決）。

#### `app/api/lines/[lineId]/adjacencies/route.ts`（新規・POST）

zod 400 → `create()` 呼び出し → `AdjacencyEndpointNotOnLineError` を 422 に写像 → 500。

#### `app/api/lines/[lineId]/adjacencies/[adjacencyId]/route.ts`（新規・DELETE）

`delete(lineId, adjacencyId)`。0行なら 404。

#### `app/lines/[lineId]/adjacencies/page.tsx`（新規）

`lines/[lineId]/directions/` と同じ階層・構成。当該路線の駅一覧から2駅を選んで追加、
既存隣接を一覧表示して各行に削除ボタン。

#### `app/lines/page.tsx`（改修）

各行の操作列に「隣接を管理」（`/lines/${line.id}/adjacencies`）を「方面を管理」の隣に追加。

### `components/DeleteButton.tsx`（改修・小）

`redirectTo` を任意化する。

```ts
type Props = { endpoint: string; redirectTo?: string; label?: string };
// handleDelete 内: res.ok なら close() → redirectTo ? router.push(redirectTo) : void 0 → router.refresh()
```

既存の全呼び出し元は `redirectTo` を渡しているため後方互換。隣接・接続の一覧内削除で
`redirectTo` 省略 → その場更新。

### `di.ts`（追記）

```ts
export const stationConnectionRepository = dbStationConnectionRepository;
export const stationConnectionCreatePageQuery = dbStationConnectionCreatePageQuery;
export const stationAdjacencyRepository = dbStationAdjacencyRepository;
export const stationAdjacencyPageQuery = dbStationAdjacencyPageQuery;
```

---

## ユニットテスト戦略

- **純粋関数**: `station-adjacency/domain/normalize.test.ts`
  （逆順入力が同一化される／等値端点はそのまま）。既存 `carSegments.test.ts` と同型
- **zod スキーマ**: 各 `features/*/schema.test.ts`。必須欠落・自己隣接の拒否。
  既存 `platform/schema.test.ts` と同型
- **route ハンドラ**: `api/stations/[stationId]/publication/route.test.ts` と同じ方式。
  `vi.mock('@/di')` で Fake Repository を注入し、正常系 / zod 400 /
  ドメインエラー写像（自己接続 400・端点不整合 422）を検証。
  Drizzle のチェーンモックは書かない（ADR-0002 が「維持不能」として却下）
- **Query Service**: `db` 実接続が要るためユニットテストしない（既存 Query Service も同様）。
  手動確認 + E2E が主たる検証

## 手動検証（`pnpm run dev`、admin :3001。Neon `development` ブランチ）

1. `/lines/new` → 路線作成 → `/lines` 一覧に出る
2. `/stations/new` → 事業者・路線を選んで駅作成 → `/stations` の当該路線配下に出る。
   `db:studio` で `publishedAt` / `slug` が NULL。`/stations/[id]/publish` から公開できる
3. `/stations/[id]/connections/new` → 相手駅を選んで接続追加 →
   `db:studio` で2行（両方向）・`source = 'manual'`。同じ組で再実行しても行が増えない
4. 駅編集ページで接続を削除 → 2行とも消える
5. `/lines/[lineId]/adjacencies` → 隣接追加 → 逆向き（B, A）で再追加しても行が増えない
6. 未認証（別ブラウザ / cookie 削除）で `POST /api/lines` → 401
7. 各生成クエリを `toSQL()` で確認: 接続候補が路線スコープに絞られている／
   複合 `ON CONFLICT` 句が出ている

## ドキュメント更新（Phase 5）

- `docs/domain/station-master-model.md` — 上書き。適用状況注記から「新規作成する UI / API は無い」を
  削除。「隣接」節の「現時点でそれを担保するコードは存在しない」を実装場所
  （`features/station-adjacency/domain/normalize.ts`）の明記に置換。「乗換接続」節の
  「現時点で行を追加する手段は無い」を削除
- `docs/domain/station-visibility.md` — 新規駅が `publishedAt = NULL` / `slug = NULL` で
  作られ、作成フォームが `slug` を扱わないことを追記
- `packages/database/src/schema.ts` — `stationConnections` / `stationAdjacencies` の
  Issue #88 を名指しするコメントを、実装場所を指す形に書き換え
- `docs/adr/` — 新規 ADR なし。既存 ADR のステータスも触らない
- GitHub Issue 起票: (1) `stationGroups` の新規作成、(2) 駅名の重複検出
