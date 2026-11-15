import { BandRow } from './bands';
import { IeltsModuleEnum, IeltsTestTypeEnum } from './entities/ielts-profile.entity';

const rows = (pairs: [number, number][]): BandRow[] => pairs.map(([min_raw, band]) => ({ min_raw, band }));

/**
 * The platform's default raw → band tables: commonly used approximate conversions. Added at boot
 * when missing (rows without an organisation); each centre can edit its own copy.
 */
export const IELTS_DEFAULT_BAND_TABLES: { module: IeltsModuleEnum.LISTENING | IeltsModuleEnum.READING; test_type: IeltsTestTypeEnum | null; rows: BandRow[] }[] = [
  {
    module: IeltsModuleEnum.LISTENING,
    test_type: null,
    rows: rows([[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]]),
  },
  {
    module: IeltsModuleEnum.READING,
    test_type: IeltsTestTypeEnum.ACADEMIC,
    rows: rows([[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]]),
  },
  {
    module: IeltsModuleEnum.READING,
    test_type: IeltsTestTypeEnum.GENERAL,
    rows: rows([[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1], [0, 0]]),
  },
];
