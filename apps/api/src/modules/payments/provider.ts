import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { AppError } from '../../shared/errors';

/**
 * Payment provider abstraction. SOLARIS never holds funds: every charge is
 * split so the seller's share settles directly to the seller's subaccount and
 * only the platform commission settles to SOLARIS.
 *
 * All amounts crossing this boundary are integers in KOBO.
 */
export interface InitializeArgs {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  subaccountCode: string;
  /** Flat platform commission in kobo, deducted from the seller's share. */
  platformFeeKobo: number;
  metadata: Record<string, string>;
}

export interface VerifiedCharge {
  reference: string;
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  amountKobo: number;
  currency: string;
  channel?: string;
  paidAt?: string;
  raw: unknown;
}

export interface Bank {
  name: string;
  code: string;
}

export interface PaymentProvider {
  readonly name: 'PAYSTACK' | 'MOCK';
  initialize(args: InitializeArgs): Promise<{ authorizationUrl: string }>;
  verify(reference: string): Promise<VerifiedCharge>;
  listBanks(): Promise<Bank[]>;
  resolveAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string }>;
  createSubaccount(args: { businessName: string; bankCode: string; accountNumber: string; percentageCharge: number }): Promise<{ subaccountCode: string }>;
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;
}

/* ───────────────────────────── Paystack */

class PaystackProvider implements PaymentProvider {
  readonly name = 'PAYSTACK' as const;
  constructor(private readonly secret: string) {}

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`https://api.paystack.co${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.secret}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      logger.error({ err, path }, 'Paystack unreachable');
      throw new AppError(502, 'PAYMENT_PROVIDER_UNAVAILABLE', 'The payment provider is not reachable right now. Please try again.');
    }
    const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
    if (!res.ok || !json?.status) {
      logger.warn({ path, status: res.status, message: json?.message }, 'Paystack request failed');
      throw new AppError(res.status === 422 || res.status === 400 ? 400 : 502, 'PAYMENT_PROVIDER_ERROR', json?.message ?? 'Payment provider error');
    }
    return json.data as T;
  }

  async initialize(a: InitializeArgs) {
    const data = await this.call<{ authorization_url: string }>('POST', '/transaction/initialize', {
      email: a.email,
      amount: a.amountKobo,
      currency: 'NGN',
      reference: a.reference,
      callback_url: a.callbackUrl,
      subaccount: a.subaccountCode,
      transaction_charge: a.platformFeeKobo,
      bearer: 'subaccount', // Paystack's processing fee is borne by the seller's share
      metadata: a.metadata,
    });
    return { authorizationUrl: data.authorization_url };
  }

  async verify(reference: string): Promise<VerifiedCharge> {
    const d = await this.call<{ reference: string; status: VerifiedCharge['status']; amount: number; currency: string; channel?: string; paid_at?: string }>(
      'GET',
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return { reference: d.reference, status: d.status, amountKobo: d.amount, currency: d.currency, channel: d.channel, paidAt: d.paid_at, raw: d };
  }

  async listBanks() {
    const banks = await this.call<Array<{ name: string; code: string; active: boolean }>>('GET', '/bank?country=nigeria&currency=NGN&perPage=200');
    return banks.filter((b) => b.active).map((b) => ({ name: b.name, code: b.code }));
  }

  async resolveAccount(accountNumber: string, bankCode: string) {
    const d = await this.call<{ account_name: string }>('GET', `/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`);
    return { accountName: d.account_name };
  }

  async createSubaccount(a: { businessName: string; bankCode: string; accountNumber: string; percentageCharge: number }) {
    const d = await this.call<{ subaccount_code: string }>('POST', '/subaccount', {
      business_name: a.businessName,
      settlement_bank: a.bankCode,
      account_number: a.accountNumber,
      // We pass an explicit flat transaction_charge per charge; this is only Paystack's default.
      percentage_charge: a.percentageCharge,
    });
    return { subaccountCode: d.subaccount_code };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
    if (!signature) return false;
    const expected = createHmac('sha512', this.secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

/* ───────────────────────────── Mock (development only) */

/** In-memory stand-in so the full flow can be exercised locally without keys. */
export const mockCharges = new Map<string, { amountKobo: number; status: VerifiedCharge['status'] }>();

class MockProvider implements PaymentProvider {
  readonly name = 'MOCK' as const;

  async initialize(a: InitializeArgs) {
    mockCharges.set(a.reference, { amountKobo: a.amountKobo, status: 'pending' });
    const q = new URLSearchParams({ reference: a.reference, amount: String(a.amountKobo), callback: a.callbackUrl });
    return { authorizationUrl: `${env.WEB_ORIGIN}/pay/mock?${q}` };
  }

  async verify(reference: string): Promise<VerifiedCharge> {
    const c = mockCharges.get(reference);
    if (!c) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Unknown payment reference');
    return { reference, status: c.status, amountKobo: c.amountKobo, currency: 'NGN', channel: 'mock', paidAt: new Date().toISOString(), raw: { mock: true } };
  }

  async listBanks() {
    return [
      { name: 'Access Bank', code: '044' },
      { name: 'First Bank of Nigeria', code: '011' },
      { name: 'Guaranty Trust Bank', code: '058' },
      { name: 'Opay (Mock)', code: '999992' },
      { name: 'United Bank For Africa', code: '033' },
      { name: 'Zenith Bank', code: '057' },
    ];
  }

  async resolveAccount(accountNumber: string) {
    if (accountNumber.startsWith('000')) throw new AppError(400, 'PAYMENT_PROVIDER_ERROR', 'Could not resolve account name');
    return { accountName: 'DEMO ACCOUNT HOLDER' };
  }

  async createSubaccount() {
    return { subaccountCode: `ACCT_mock_${randomUUID().slice(0, 8)}` };
  }

  verifyWebhookSignature() {
    return false; // mock payments are completed via the dev-only endpoint, never via webhooks
  }
}

let cached: PaymentProvider | null | undefined;

/** The configured provider, or null when payments are not set up. */
export function paymentProvider(): PaymentProvider | null {
  if (cached !== undefined) return cached;
  if (env.PAYMENTS_PROVIDER === 'paystack') cached = env.PAYSTACK_SECRET_KEY ? new PaystackProvider(env.PAYSTACK_SECRET_KEY) : null;
  else if (env.PAYMENTS_PROVIDER === 'mock') cached = new MockProvider();
  else cached = null;
  return cached;
}

export function requireProvider(): PaymentProvider {
  const p = paymentProvider();
  if (!p) throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Online payments are not available yet.');
  return p;
}

/** Test hook — reset the cached provider after changing env. */
export function resetPaymentProvider() {
  cached = undefined;
}
