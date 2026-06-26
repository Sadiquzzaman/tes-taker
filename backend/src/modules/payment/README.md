# SSLCommerz Payment Module (Sandbox)

Self-contained NestJS module for SSLCommerz sandbox payments: session creation, validation-API verification, IPN reconciliation, and gateway callbacks.

All routes are served under the global prefix and URI version, e.g. `POST /api/v1/payments/initiate`.

## Structure

```
src/modules/payment/
├── payment.module.ts
├── payment.controller.ts
├── payment.service.ts
├── dto/
│   ├── initiate-payment.dto.ts
│   ├── verify-payment.dto.ts
│   └── sslcommerz-callback.dto.ts
├── interfaces/
│   └── sslcommerz.interface.ts
├── entities/
│   └── payment.entity.ts
└── enums/
    └── payment-status.enum.ts
```

## Environment Variables

| Variable | Description | Example |
| --- | --- | --- |
| `SSL_STORE_ID` | Sandbox store id | `magne6a3d8f92c572f` |
| `SSL_STORE_PASSWORD` | Sandbox store password | `magne6a3d8f92c572f@ssl` |
| `SSL_SESSION_API` | Session (initiate) API | `https://sandbox.sslcommerz.com/gwprocess/v4/api.php` |
| `SSL_VALIDATION_API` | Validation API | `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php` |
| `BACKEND_BASE_URL` | Public backend base URL (used to build `ipn_url`) | `http://localhost:5000` |
| `FRONTEND_BASE_URL` | Frontend base URL (used to build success/fail/cancel URLs) | `http://localhost:3000` |

No credentials or URLs are hardcoded; everything is read via `ConfigService`.

> IPN needs a public URL. For local testing, expose the backend with ngrok and set `BACKEND_BASE_URL` to the ngrok URL so `ipn_url` is reachable.

## Payment Status

`PENDING` → `PAID` | `FAILED` | `CANCELLED`

A `PAID` payment is terminal and is never downgraded by later callbacks.

## Callback URLs sent to the gateway

- `success_url` = `FRONTEND_BASE_URL/payment/success`
- `fail_url` = `FRONTEND_BASE_URL/payment/fail`
- `cancel_url` = `FRONTEND_BASE_URL/payment/cancel`
- `ipn_url` = `BACKEND_BASE_URL/api/v1/payments/ipn`

The backend `success`/`fail`/`cancel` endpoints are also provided for server-side use; if you later point the gateway directly at the backend, success always re-validates through the validation API.

## Endpoints

All non-callback responses are wrapped by the global interceptor as:

```json
{ "statusCode": 201, "message": "...", "payload": { }, "error": false }
```

### POST /api/v1/payments/initiate

Request:

```json
{
  "orderId": "ORDER_123",
  "amount": 1000,
  "customer": { "name": "John Doe", "email": "john@example.com", "phone": "017xxxxxxxx" },
  "productName": "Premium Subscription",
  "productCategory": "subscription"
}
```

Response `payload`:

```json
{
  "paymentId": "0f0b...uuid",
  "orderId": "ORDER_123",
  "transactionId": "TT_LZ3K9_8F21AB0C",
  "amount": 1000,
  "currency": "BDT",
  "gatewayPageUrl": "https://sandbox.sslcommerz.com/EasyCheckOut/..."
}
```

The frontend redirects the user to `gatewayPageUrl`.

### POST /api/v1/payments/verify

Called by the frontend success page. Provide `val_id` (preferred) or `transactionId`:

```json
{ "val_id": "2406...", "transactionId": "TT_LZ3K9_8F21AB0C" }
```

Response `payload` is the updated payment (status `PAID` on success). Idempotent — calling again returns the same `PAID` record.

### POST /api/v1/payments/ipn

Receives the gateway's urlencoded body (`tran_id`, `val_id`, `status`, ...). Verifies through the validation API and reconciles status. Idempotent. Returns `{ received: true, status }`.

### POST /api/v1/payments/success | /fail | /cancel

Server-side gateway callbacks (urlencoded). `success` re-validates before marking `PAID`; `fail`/`cancel` mark the payment only if still `PENDING`.

### GET /api/v1/payments/:transactionId

Returns the stored payment by `tran_id` (status polling / debugging).

## Validation rules

- Only `VALID` or `VALIDATED` validation statuses settle a payment.
- Validated amount must match the recorded amount (tolerance 0.01).
- Validated `tran_id` must match the stored `tran_id`.
- Frontend success is never trusted without a validation-API check.

## Idempotency & consistency

- Settlement and terminal transitions run inside a DB transaction with a `pessimistic_write` row lock, so concurrent verify/IPN requests cannot create inconsistent states.
- Already-`PAID` payments short-circuit (no re-processing).
- Raw `gatewayResponse` and `validationResponse` are stored as JSONB for debugging.

## Sandbox testing

1. Set the env vars above (sandbox credentials are already provided in `.env`).
2. Start the backend: `npm run start:dev` (listens on `APP_PORT`, default 5000).
3. `POST /api/v1/payments/initiate` and open the returned `gatewayPageUrl`.
4. Complete the sandbox payment; the gateway redirects to the frontend pages.
5. On the success page, call `POST /api/v1/payments/verify` with the `val_id` from the redirect query string.
6. (Optional) Test IPN by exposing the backend via ngrok and setting `BACKEND_BASE_URL` to the ngrok URL.

## Database entity (`payments`)

`id`, `orderId`, `transactionId` (unique), `amount`, `currency`, `status`, `sslValId`, `paymentMethod`, `customerName`, `customerEmail`, `customerPhone`, `gatewayResponse` (JSONB), `validationResponse` (JSONB), `createdAt`, `updatedAt`.
