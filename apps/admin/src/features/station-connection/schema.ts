import { z } from 'zod';

// 乗換接続の新規作成フォームの入力（#88）。既存の
// `PUT /api/station-connections/[connectionId]`（`lib/validations.ts` の
// `stationConnectionUpdateSchema`）は難易度・備考だけを更新する。作成では相手駅も要る。
//
// 難易度の enum は @furatora/database/enums の union のコピー。zod v4 の z.enum に
// union 型を直接渡せないため、既存の `stationConnectionUpdateSchema` と同じくハードコピーする。
export const stationConnectionCreateSchema = z.object({
  connectedStationId: z.string().uuid(),
  strollerDifficulty: z
    .enum(['optimal', 'elevator_detour', 'stairs_partial', 'exit_required', 'inaccessible'])
    .nullable()
    .optional(),
  wheelchairDifficulty: z
    .enum(['optimal', 'detour', 'assistance_required', 'discouraged', 'inaccessible'])
    .nullable()
    .optional(),
  notesAboutStroller: z.string().nullable().optional(),
  notesAboutWheelchair: z.string().nullable().optional(),
});

// 自己接続（connectedStationId === URL の stationId）の排除は route.ts で行う。
// stationId は URL パラメータでボディに無いため schema の .refine() には渡せない。
export type StationConnectionCreateInput = z.infer<typeof stationConnectionCreateSchema>;
