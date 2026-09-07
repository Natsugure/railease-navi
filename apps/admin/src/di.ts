// コンポジションルート。DIライブラリは使わず手動配線する（ADR-0002）。
import { dbPlatformRepository } from '@/external/repository/platformRepository';
import { dbPlatformLocationRepository } from '@/external/repository/platformLocationRepository';
import { dbStopPatternRepository } from '@/external/repository/stopPatternRepository';
import { dbStopPatternPageQuery } from '@/external/query/stopPatternPageQuery';
import { dbStationPublishingRepository } from '@/external/repository/stationPublishingRepository';
import { dbStationPublishingPageQuery } from '@/external/query/stationPublishingPageQuery';
import { dbTrainEditPageQuery } from '@/external/query/trainEditPageQuery';
import { dbLineEditPageQuery, dbLineDirectionEditPageQuery } from '@/external/query/lineEditPageQuery';
import { dbStationEditPageQuery } from '@/external/query/stationEditPageQuery';
import { dbPlatformEditPageQuery } from '@/external/query/platformEditPageQuery';
import { dbFacilityEditPageQuery } from '@/external/query/facilityEditPageQuery';

export const platformRepository = dbPlatformRepository;
export const platformLocationRepository = dbPlatformLocationRepository;
export const stopPatternRepository = dbStopPatternRepository;
export const stopPatternPageQuery = dbStopPatternPageQuery;
export const stationPublishingRepository = dbStationPublishingRepository;
export const stationPublishingPageQuery = dbStationPublishingPageQuery;

// 編集・新規ページの選択肢データ（#49 でフォームのクライアント側 fetch を廃止）
export const trainEditPageQuery = dbTrainEditPageQuery;
export const lineEditPageQuery = dbLineEditPageQuery;
export const lineDirectionEditPageQuery = dbLineDirectionEditPageQuery;
export const stationEditPageQuery = dbStationEditPageQuery;
export const platformEditPageQuery = dbPlatformEditPageQuery;
export const facilityEditPageQuery = dbFacilityEditPageQuery;
