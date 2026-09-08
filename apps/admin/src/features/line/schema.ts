import { z } from 'zod';

// 路線の新規作成フォームの入力。既存の PUT 用 `lib/validations.ts` の
// `lineUpdateSchema` はコピーせず、feature ローカルの規約（z.infer で Input 型を export）に従う。
//
// `slug` は含めない。`lines.slug` は公開駅の URL を組み立てる前提の値で、
// インポート・新規作成では書かず、公開操作の周辺で管理者が確定する
// （docs/domain/station-master-model.md「slug の導出規則」）。作成時は NULL でよく、
// 既存の `PUT /api/lines/[lineId]` で後から設定できる。
// `ekidataLineCd` も手動追加行は持ち得ないため設定しない（ADR-0007 決定3）。
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
