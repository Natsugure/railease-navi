import { z } from 'zod';

// 駅の新規作成フォームの入力。既存の PUT 用 `lib/validations.ts` の
// `stationUpdateSchema` はコピーせず、feature ローカルの規約（z.infer で Input 型を export）に従う。
//
// 【slug を含めない】`stations.slug` はインポート・新規作成では書かず、公開操作で
// 管理者が確定する（docs/domain/station-master-model.md「slug の導出規則」）。
// 新規駅は publishedAt = NULL / slug = NULL で作られ、CHECK 制約
// `published_requires_slug`（published_at IS NULL OR slug IS NOT NULL）を自然に満たす。
// `ekidataStationCd` も手動追加行は持ち得ないため設定しない（ADR-0007 決定3）。
//
// lineId は stationLines に1行入れるために必須。粒度が「路線×駅」であるため
// （docs/domain/station-master-model.md「粒度は暫定である」）、新規駅も路線の指定を伴う。
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
