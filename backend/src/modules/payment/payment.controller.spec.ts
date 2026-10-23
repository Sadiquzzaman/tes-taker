import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

/**
 * P0-05: initiate, lookup and verify need a valid login; the SSLCommerz
 * callbacks stay reachable without one. Runs the real JWT guard over HTTP.
 */
describe('PaymentController auth (P0-05)', () => {
  const TEST_JWT_SECRET = 'unit-test-only-secret';
  const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';
  const previousSecret = process.env.JWT_SECRET;

  let app: INestApplication;
  let baseUrl: string;
  let token: string;
  const paymentService = {
    initiatePayment: jest.fn(),
    verifyPayment: jest.fn(),
    getByTransactionId: jest.fn(),
    handleIpn: jest.fn(),
    handleSuccessCallback: jest.fn(),
    getFrontendBaseUrl: jest.fn(() => 'https://app.example.test'),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [PaymentController],
      providers: [JwtStrategy, { provide: PaymentService, useValue: paymentService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
    await app.listen(0);
    baseUrl = `${await app.getUrl()}/api/v1/payments`.replace('[::1]', 'localhost');

    token = new JwtService({ secret: TEST_JWT_SECRET }).sign({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'owner@example.test',
      full_name: 'Owner Teacher',
      role: 'TEACHER',
      phone: '00000000000',
    });
  });

  afterAll(async () => {
    await app.close();
    process.env.JWT_SECRET = previousSecret;
  });

  beforeEach(() => jest.clearAllMocks());

  const post = (path: string, body: unknown, auth?: string) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body),
      redirect: 'manual',
    });

  it('refuses an unauthenticated initiate', async () => {
    const res = await post('/initiate', { subscriptionId: SUBSCRIPTION_ID, amount: 1 });

    expect(res.status).toBe(401);
    expect(paymentService.initiatePayment).not.toHaveBeenCalled();
  });

  it('refuses an initiate with a forged token', async () => {
    const forged = new JwtService({ secret: 'not-the-secret' }).sign({ id: 'x', role: 'TEACHER' });
    const res = await post('/initiate', { subscriptionId: SUBSCRIPTION_ID }, forged);

    expect(res.status).toBe(401);
    expect(paymentService.initiatePayment).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated lookup', async () => {
    const res = await fetch(`${baseUrl}/TT_TEST_1`);

    expect(res.status).toBe(401);
    expect(paymentService.getByTransactionId).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated verify', async () => {
    const res = await post('/verify', { transactionId: 'TT_TEST_1' });

    expect(res.status).toBe(401);
    expect(paymentService.verifyPayment).not.toHaveBeenCalled();
  });

  it('passes only the subscription id and the caller to the service when logged in', async () => {
    paymentService.initiatePayment.mockResolvedValue({ gatewayPageUrl: 'https://sandbox.example.test/pay' });

    const res = await post('/initiate', { subscriptionId: SUBSCRIPTION_ID, amount: 1 }, token);

    expect(res.status).toBe(201);
    const [dto, user] = paymentService.initiatePayment.mock.calls[0];
    expect(dto).toEqual({ subscriptionId: SUBSCRIPTION_ID });
    expect(user).toMatchObject({ id: '11111111-1111-4111-8111-111111111111' });
  });

  it('looks up with the caller id when logged in', async () => {
    paymentService.getByTransactionId.mockResolvedValue({ transactionId: 'TT_TEST_1' });

    const res = await fetch(`${baseUrl}/TT_TEST_1`, { headers: { Authorization: `Bearer ${token}` } });

    expect(res.status).toBe(200);
    expect(paymentService.getByTransactionId).toHaveBeenCalledWith('TT_TEST_1', '11111111-1111-4111-8111-111111111111');
  });

  it('keeps the gateway callbacks reachable without a login', async () => {
    paymentService.handleIpn.mockResolvedValue({ received: true, status: 'PENDING' });
    paymentService.handleSuccessCallback.mockResolvedValue({ transactionId: 'TT_TEST_1', status: 'PAID' });

    const ipn = await post('/ipn', { tran_id: 'TT_TEST_1' });
    const success = await post('/success', { tran_id: 'TT_TEST_1', val_id: 'val-1' });

    expect(ipn.status).toBe(201);
    expect(success.status).toBe(302);
    expect(success.headers.get('location')).toBe('https://app.example.test/payment/success?tran_id=TT_TEST_1');
  });
});
