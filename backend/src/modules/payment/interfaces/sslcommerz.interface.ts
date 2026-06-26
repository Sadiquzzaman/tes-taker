export interface SslCommerzConfig {
  storeId: string;
  storePassword: string;
  sessionApi: string;
  validationApi: string;
  backendBaseUrl: string;
  frontendBaseUrl: string;
}

/**
 * Response returned by the SSLCommerz session (initiate) API.
 * Only the fields the integration relies on are typed; the rest are kept for debugging.
 */
export interface SslSessionResponse {
  status: string;
  failedreason?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
  redirectGatewayURL?: string;
  [key: string]: unknown;
}

/**
 * Response returned by the SSLCommerz validation API.
 */
export interface SslValidationResponse {
  status: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  store_amount?: string;
  currency?: string;
  card_type?: string;
  card_issuer?: string;
  risk_level?: string;
  [key: string]: unknown;
}

/**
 * Common shape of the form-encoded body SSLCommerz POSTs to callback/IPN URLs.
 */
export interface SslCallbackPayload {
  tran_id?: string;
  val_id?: string;
  amount?: string;
  currency?: string;
  status?: string;
  card_type?: string;
  [key: string]: unknown;
}
