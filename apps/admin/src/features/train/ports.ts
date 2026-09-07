// 読み取り: Query Service（ADR-0003）。列車の新規・編集ページが必要とする
// 選択肢（事業者・路線）と、編集時は列車本体・号車構成・設備を1画面分の DTO で返す。
// admin 全体の Query Service 化は #48 だが、フォームのクライアント側 fetch 廃止（#49）に
// 伴い、src/app/** から @furatora/database を直接 import できない親ページのために先行導入する。

export type OperatorOption = { id: string; name: string };

// TrainForm の路線セレクトは名前のみ表示する。nameEn/operatorId は将来の
// 事業者絞り込み用に取得しておく（現状フォームは全路線を出す）。
export type TrainLineOption = {
  id: string;
  name: string;
  nameEn: string;
  operatorId: string;
};

export type TrainCarStructureDTO = {
  carNumber: number;
  doorCount: number;
  carLength: number | null;
};

export type TrainEquipmentDTO = {
  carNumber: number;
  nearDoor: number;
  isStandard: boolean;
};

export type TrainEditContext = {
  operators: OperatorOption[];
  lines: TrainLineOption[];
  train?: {
    id: string;
    name: string;
    operatorId: string;
    lineIds: string[];
    carCount: number;
    carStructure: TrainCarStructureDTO[] | null;
    freeSpaces: TrainEquipmentDTO[];
    prioritySeats: TrainEquipmentDTO[];
  };
};

export interface TrainEditPageQuery {
  getCreateContext(): Promise<TrainEditContext>;
  // 該当列車が無ければ null（ページは notFound() する）
  getEditContext(trainId: string): Promise<TrainEditContext | null>;
}
