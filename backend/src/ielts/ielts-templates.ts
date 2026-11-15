import { IeltsModuleEnum } from './entities/ielts-profile.entity';

/** The modules in test order: Listening, Reading and Writing run one after another; Speaking is separate. */
export const MODULE_ORDER: readonly IeltsModuleEnum[] = [IeltsModuleEnum.LISTENING, IeltsModuleEnum.READING, IeltsModuleEnum.WRITING, IeltsModuleEnum.SPEAKING];

/** Parts per module in the real test: Listening 1–4, Reading passages 1–3, Writing tasks 1–2, Speaking 1–3. */
export const PART_COUNT: Record<IeltsModuleEnum, number> = {
  [IeltsModuleEnum.LISTENING]: 4,
  [IeltsModuleEnum.READING]: 3,
  [IeltsModuleEnum.WRITING]: 2,
  [IeltsModuleEnum.SPEAKING]: 3,
};

/** Listening's time to check answers at the end, on top of its duration. */
export const LISTENING_REVIEW_SECONDS = 120;

/** A mock's time per module: Listening about 30 minutes, Reading 60, Writing 60, Speaking 11–14. */
export const MOCK_DURATIONS: Record<IeltsModuleEnum, number> = {
  [IeltsModuleEnum.LISTENING]: 30 * 60,
  [IeltsModuleEnum.READING]: 60 * 60,
  [IeltsModuleEnum.WRITING]: 60 * 60,
  [IeltsModuleEnum.SPEAKING]: 14 * 60,
};

/** A practice set's suggested time per part (Writing Task 1 20 minutes, Task 2 40). */
const PRACTICE_PART_SECONDS: Record<IeltsModuleEnum, (partNo: number) => number> = {
  [IeltsModuleEnum.LISTENING]: () => 8 * 60,
  [IeltsModuleEnum.READING]: () => 20 * 60,
  [IeltsModuleEnum.WRITING]: (partNo) => (partNo === 1 ? 20 : 40) * 60,
  [IeltsModuleEnum.SPEAKING]: (partNo) => (partNo === 2 ? 4 : 5) * 60,
};

export const practiceDuration = (module: IeltsModuleEnum, partNos: readonly number[]): number =>
  partNos.reduce((sum, partNo) => sum + PRACTICE_PART_SECONDS[module](partNo), 0);

/** Limits on a module's time a teacher can set: 1 minute to 3 hours. */
export const MIN_MODULE_SECONDS = 60;
export const MAX_MODULE_SECONDS = 3 * 60 * 60;

/** Modules in test order. */
export const sortModules = (modules: readonly IeltsModuleEnum[]): IeltsModuleEnum[] => MODULE_ORDER.filter((m) => modules.includes(m));
