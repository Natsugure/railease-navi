// コンポジションルート。DIライブラリは使わず手動配線する（ADR-0002）。
import { dbPlatformRepository } from '@/external/repository/platformRepository';
import { dbPlatformLocationRepository } from '@/external/repository/platformLocationRepository';
import { dbStopPatternRepository } from '@/external/repository/stopPatternRepository';
import { dbStopPatternPageQuery } from '@/external/query/stopPatternPageQuery';
import { dbStationPublishingRepository } from '@/external/repository/stationPublishingRepository';
import { dbStationPublishingPageQuery } from '@/external/query/stationPublishingPageQuery';
import { dbTrainEditPageQuery } from '@/external/query/trainEditPageQuery';
import { dbLineEditPageQuery, dbLineDirectionEditPageQuery } from '@/external/query/lineEditPageQuery';
import { dbLineRepository } from '@/external/repository/lineRepository';
import { dbStationEditPageQuery } from '@/external/query/stationEditPageQuery';
import { dbStationCreatePageQuery } from '@/external/query/stationCreatePageQuery';
import { dbStationRepository } from '@/external/repository/stationRepository';
import { dbStationConnectionRepository } from '@/external/repository/stationConnectionRepository';
import { dbStationConnectionCreatePageQuery } from '@/external/query/stationConnectionCreatePageQuery';
import { dbStationAdjacencyRepository } from '@/external/repository/stationAdjacencyRepository';
import { dbStationAdjacencyPageQuery } from '@/external/query/stationAdjacencyPageQuery';
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

// 駅・路線マスタの新規作成（#88）
export const lineRepository = dbLineRepository;
export const stationRepository = dbStationRepository;
export const stationCreatePageQuery = dbStationCreatePageQuery;
export const stationConnectionRepository = dbStationConnectionRepository;
export const stationConnectionCreatePageQuery = dbStationConnectionCreatePageQuery;
export const stationAdjacencyRepository = dbStationAdjacencyRepository;
export const stationAdjacencyPageQuery = dbStationAdjacencyPageQuery;
export const stationEditPageQuery = dbStationEditPageQuery;
export const platformEditPageQuery = dbPlatformEditPageQuery;
export const facilityEditPageQuery = dbFacilityEditPageQuery;
