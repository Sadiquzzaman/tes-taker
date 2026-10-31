/** A Bangladeshi mobile number, 01XXXXXXXXX (FND-09); the API checks the same rule. */
const BD_MOBILE = /^01[3-9]\d{8}$/;

export const MAX_GUARDIANS = 2;
export const GUARDIAN_RELATIONS: GuardianRelation[] = ["FATHER", "MOTHER", "OTHER"];

/** The number as the API stores it: digits only, +880 / 880 dropped, a missing leading 0 added. */
export const normalizeBdMobile = (input: string) => {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) digits = `0${digits.slice(3)}`;
  if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;
  return digits;
};

export const isBdMobile = (input: string) => BD_MOBILE.test(normalizeBdMobile(input));

export interface GuardianDraft {
  id?: string;
  name: string;
  relation: GuardianRelation;
  phone: string;
  is_primary: boolean;
}

/** Per guardian, the message key of its first problem (under `academics.guardians`), or null. */
export const guardianErrors = (drafts: GuardianDraft[]) => {
  const seen = new Set<string>();
  return drafts.map((draft) => {
    const errors: { name?: "nameRequired"; phone?: "invalidPhone" | "samePhone" } = {};
    if (!draft.name.trim()) errors.name = "nameRequired";
    const phone = normalizeBdMobile(draft.phone);
    if (!isBdMobile(draft.phone)) errors.phone = "invalidPhone";
    else if (seen.has(phone)) errors.phone = "samePhone";
    seen.add(phone);
    return errors;
  });
};
