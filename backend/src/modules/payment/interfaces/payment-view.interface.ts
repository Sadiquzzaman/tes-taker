import { PaymentStatusEnum } from '../enums/payment-status.enum';

/** What the owner of a payment sees when looking it up. */
export interface PaymentView {
  transactionId: string;
  status: PaymentStatusEnum;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  subscriptionId?: string;
}
