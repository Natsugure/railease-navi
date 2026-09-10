# アーキテクチャ決定記録（ADR）

このディレクトリは、furatora のアーキテクチャに関する決定を記録します。

## ADRとは

ADR（Architecture Decision Record）は、**なぜその設計を選んだのか**を、
却下した選択肢とその理由を含めて記録するものです。

コードを読めば「何がどうなっているか」は分かりますが、
「なぜ他の選択肢ではないのか」はコードに残りません。
数ヶ月後に同じ議論を再演しないために ADR を書きます。

## 形式

**MADR（Markdown Architecture Decision Records）** 形式を採用します。

Nygard 形式（Context / Decision / Consequences）ではなく MADR を選んだ理由は、
Nygard には**却下した選択肢の置き場が無い**ためです。
furatora のアーキテクチャ決定は代替案の比較が主成分であり、
「何を選んだか」より「何を却下したか」の方が価値があります。

## ステータス

| ステータス               | 意味                                           |
| ------------------------ | ---------------------------------------------- |
| `Proposed`               | 提案済み。合意はあるが、実装による検証は未完了 |
| `Accepted`               | 実装・検証を通過した                           |
| `Deprecated`             | 非推奨。後継は無いが、新規に従うべきではない   |
| `Superseded by ADR-000X` | 別のADRに置き換えられた                        |

**ADRは、Accepted後は書き換えません。** 決定が覆った場合は、新しいADRを作成し、
旧ADRのステータスを `Superseded by ADR-000X` に変更します。
これにより「いつ・なぜ方針が変わったか」が履歴として残ります。

## 採番

- `NNNN-kebab-case-title.md` の形式で、0001 から連番
- 欠番・再利用はしない

## ADRに書くもの / 書かないもの

| 書く                                 | 書かない                                              |
| ------------------------------------ | ----------------------------------------------------- |
| 覆すときに明示的な意思決定が要るもの | 時間とともに陳腐化する実装計画 → `docs/spec/tasks.md` |
| 却下した選択肢とその根拠             | 具体的な型定義・シグネチャ → `docs/spec/design.md`    |
| 判断の前提となった実測値             | 未決事項・調査タスク → GitHub Issue                   |

## 一覧

| ID                                            | タイトル                                                                         | ステータス | 日付       |
| --------------------------------------------- | -------------------------------------------------------------------------------- | ---------- | ---------- |
| [0001](./0001-layer-structure.md)             | 4層構成（app / features / shared / external）と依存ルール                        | Proposed   | 2026-08-14 |
| [0002](./0002-dependency-inversion-ports.md)  | DBアクセスに ports パターンで依存性逆転を導入する                                | Proposed   | 2026-08-14 |
| [0003](./0003-read-write-separation.md)       | 読み取りと書き込みで異なる抽象を用いる（Query Service / Repository）             | Proposed   | 2026-08-14 |
| [0004](./0004-neon-branch-dev-environment.md) | 開発環境を Neon ブランチに統一し、ローカル PostgreSQL / Docker を廃止する        | Proposed   | 2026-08-15 |
| [0005](./0005-write-atomicity-driver.md)      | 書き込みの原子性を担保するため、読み取りと書き込みで Neon のドライバを使い分ける | Proposed   | 2026-08-15 |
| [0006](./0006-diagram-text-in-html-overlay.md) | ホーム図のテキストは SVG ではなく HTML オーバーレイ層に置く                      | Proposed   | 2026-08-23 |
| [0007](./0007-station-master-data-source.md) | 駅・路線マスタを ODPT 同期から駅データ.jp の初回シードに移行し、以後は手動で維持する | Accepted   | 2026-08-27 |
| [0008](./0008-environment-database-branch-mapping.md) | 環境ごとに Neon ブランチを1対1で対応させ、マイグレーションをビルド時に適用する | Accepted   | 2026-09-01 |
| [0009](./0009-list-query-server-side-scoping.md) | 一覧の絞り込み・並び替え・ページングをサーバー側で行い、URLクエリを唯一の状態源とする | Proposed   | 2026-09-10 |

## 関連ドキュメント

- [`docs/domain/`](../domain/README.md) — 現在のシステムの姿。ADRと違い、古くなったら上書きする
- [`docs/spec/requirements.md`](../spec/requirements.md) — 要件（EARS記法）
- [`docs/spec/design.md`](../spec/design.md) — 技術設計。ADRの結論を反映するが、根拠は重複させずADRを参照する
- [`docs/spec/tasks.md`](../spec/tasks.md) — 実装計画
