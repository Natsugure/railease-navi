# 列車の停車位置パターン

> **適用状況**: 2026-09-06 現在、**実装済み・E2E検証未完了**。
> `packages/database/src/schema.ts`（`trainStopPatterns` / `trainStopPatternCars`）、
> Admin の停車位置パターン編集（`apps/admin/src/features/stop-pattern/`）、
> Web のホーム描画（`apps/web/src/features/platform/`）はいずれも本書に一致する。
> メートル座標化の E2E 検証が [Issue #29](https://github.com/Natsugure/furatora/issues/29)
> で未完のため本注記を残す。検証完了時に外すこと。
> （2026-08-15 時点の「未実装」表記は、その後の Admin/Web 追随が本書へ反映されて
> いなかったための古い記述であり、ここで上書きした。）

「あるホームに、ある列車が、どの位置に停まるか」を、
[ホーム座標系](./platform-coordinate-system.md)上のメートル値で表す。

## モデル

```
trainStopPatterns
  ├── platformId, trainId
  ├── unique(platformId, trainId)
  └── trainStopPatternCars (FK: trainStopPatternId, CASCADE)
        ├── carNumber
        ├── startMeters
        └── endMeters
```

号車ごとに区間 `[startMeters, endMeters]` を持つ。
**`order` によらず、どの号車も `startMeters < endMeters` を保つ**
（号車番号の向きが反転しても、区間そのものの向きは反転しない）。

### 隣接号車は境界を共有する

**`carNumber` が隣り合う号車どうしは、`cars[i].endMeters === cars[i+1].startMeters` を保つ。**
編成に重なり・隙間ができることは物理的に起こり得ないため、この座標系上でも許容しない。

これは `startMeters < endMeters` と違い、DB のカラム制約にはまだ現れていない
（`trainStopPatternCars` の一意な保証は各行の `startMeters < endMeters` のみ）。
Admin の図上編集（`apps/admin/src/features/station-layout/domain/editDraft.ts`
の `moveCarBoundary`）が、境界を動かすときに隣接号車の `end`/`start` を常に
同値で書き換えることで、この不変条件をクライアント側で構造的に守っている。
**サーバー側スキーマ（`trainStopPatternSchema`）での強制はまだ入っていない**
（既存データに不連続な編成が無いことを確認してから追加する。確認作業は
Issue #95 PR3 の引き継ぎ事項）。

## 標準車両長

**20.0 m**（`DEFAULT_CAR_LENGTH`）。

`trainCarStructures.carLength` が指定されていればそちらを使い、
未指定（null）の場合に標準値を用いる。号車ごとに長さの異なる編成を
表現するためのカラムであり、通常は未指定でよい。

## 号車位置の算出

`features/stop-pattern/domain/carSegments.ts` の `buildCarSegments()`（純関数）が行う。
管理者は次の2つを入力する。

1. **編成の `x=0` に近い側の端**が、ホーム端（`x=0`）から何メートルの位置に来るか
2. **`x=0` に近い側が1号車か、最終号車か**（`carOneNearest` / `lastCarNearest`）

`x=0` に近い側から `carLength` を積算して各号車の区間を決める。
算出結果はプレビュー表示され、管理者が個別の号車境界を上書きできる。
保存されるのは**確定した座標**であり、算出パラメータは保持しない。

基準を「先頭車」ではなく「`x=0` に近い側の端」とするのは、
「先頭車」基準だとその先頭が x のどちら側にあるかが別途必要になり、
入力が2つの独立した二択に分かれて曖昧になるため。上記の形なら
「位置1つ + 号車番号の向き1つ」で一意に定まる。

## 列車の表示判定

**あるホームにどの列車を表示するかは、停車位置パターンが登録されているかどうかのみで決まる。**
号車数とホーム長を比較した自動判定は行わない。

この帰結として、**パターンが未登録の列車はホーム表示に出てこない。**
エラーではなく正常系として扱う。データ投入時は、表示したい
(ホーム × 列車) の組み合わせすべてにパターンを登録する必要がある。

## 現在の制約: 方面別のパターンを持たない

一意キーが `(platformId, trainId)` であるため、
**同一ホーム・同一列車に対して停車位置パターンは1件しか持てない。**

この制約は、対象事業者（東京メトロ・東京都交通局）に上下共用のホームが
存在しないことに依存している。2026-08-15 時点で `inbound_direction_id` と
`outbound_direction_id` の両方が設定された `platforms` レコードは0件。

| ケース | 成立するか |
|---|---|
| 片方向のホーム | ✅ 1件で足りる |
| 折返しホーム（終端駅・支線） | ✅ 進行方向は反転するが**編成は物理的に反転しない**ため停車位置は1通り |
| **上下共用の中線**（JRの国鉄型2面3線等） | ❌ 逆向きの停車で号車座標が2通り必要になるが登録できない |

3つ目が破綻すると、片方の方面で号車番号が左右反転し、
「2号車付近のエレベーター」が実際には7号車付近を指す**誤案内**になる。

### `platforms` を番線ごとに分ける回避策は使えない

設備は `platformId` にぶら下がっている。

```
platformLocations.platformId → platforms.id
  ├── platformLocationCells → stationFacilities
  └── facilityConnections
```

同一の物理ホームを2レコードに分けると、設備・コンコース・乗り換え接続が
**二重登録**になり、コンコース単位グルーピングが同じ階段を別物として扱い始める。
この回避策は検討済みであり、成立しない。

### 対応が必要になったときの移行手順

**トリガー**: 上下共用の中線を持つ事業者（JR東日本等）を追加するとき。
**この作業は当該Issueの見積もりに必ず含めること。**

1. `trainStopPatterns` に `directionId`（nullable、`→ lineDirections.id`）を追加する。
   セマンティクスは **`null` = このホームの全方面に共通**
2. 一意キーを `(platformId, trainId, directionId)` に変更し、
   **`.nullsNotDistinct()` を付ける**。PostgreSQL の `UNIQUE` は既定で NULL 同士を
   重複とみなさないため、これが無いと「方面なし」のパターンを何件でも登録できてしまう
   （drizzle-orm 0.45.1 に実装あり。Neon は PG15+ で利用可）
3. 読み取り側に「タブの方面に一致するパターン → 無ければ `null` のパターン」という
   フォールバック解決を追加する
4. Admin の入力欄は既定「全方面共通」とし、必要なホームでのみ方面を選ばせる

**既存レコードは `directionId = null` のまま意味が通るため、データ変換・再入力は発生しない。**

### Issue #29 で対応しなかった理由

JR追加時点で必要なキーが本当に「方面」なのかが未確定なため。
中線は方面ではなく運用（待避・折返し）で停車位置が分かれる可能性があり、
また号車数が10両/15両で大きく変わるため `trains` の粒度自体の見直しが入りうる。
実データが1件も無い状態で解決ロジックを設計すると作り直しになる
（[ADR-0002](../adr/0002-dependency-inversion-ports.md) の「推測で設計しない」と同じ判断）。

## 関連

- [platform-coordinate-system.md](./platform-coordinate-system.md) — 座標の原点・単位・描画範囲
- [ADR-0005](../adr/0005-write-atomicity-driver.md) — 親子 insert の原子性（`withTransaction`）
