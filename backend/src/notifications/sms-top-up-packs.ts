/** A self-serve SMS top-up (FND-13). The price is set here, on the server, never by the browser. */
export interface SmsTopUpPack {
  id: string;
  credits: number;
  /** BDT */
  price: number;
}

/** Owner decision, 30 Oct (starting values). */
export const SMS_TOP_UP_PACKS: readonly SmsTopUpPack[] = [
  { id: 'sms_500', credits: 500, price: 300 },
  { id: 'sms_1000', credits: 1_000, price: 550 },
  { id: 'sms_5000', credits: 5_000, price: 2_500 },
];

export const findSmsTopUpPack = (id: string): SmsTopUpPack | undefined => SMS_TOP_UP_PACKS.find((pack) => pack.id === id);

/** The owner is warned when this share of the month's credits is left (FND-13). */
export const SMS_LOW_CREDIT_SHARE = 0.1;
