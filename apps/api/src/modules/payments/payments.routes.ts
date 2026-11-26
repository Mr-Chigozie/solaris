import express, { Router, type Request } from 'express';
import { payoutAccountSchema, z, type PayoutAccountDto } from '@solaris/validation';
import { isProduction } from '../../config/env';
import { logger } from '../../lib/logger';
import { requireAuth, requireOrgPermission } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';
import { applySuccessfulCharge } from '../commerce/commerce.service';
import { getSetting } from '../settings/settings.service';
import { mockCharges, paymentProvider, requireProvider, type Bank } from './provider';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const orgId = (req: Request) => (typeof req.params.orgId === 'string' && UUID_RE.test(req.params.orgId) ? req.params.orgId : undefined);

/**
 * Paystack webhook. Must receive the RAW body to verify the HMAC signature,
 * so it is mounted before the JSON body parser. The charge is re-verified with
 * Paystack's API before anything is marked paid.
 */
export const paystackWebhook = Router();
paystackWebhook.post('/api/v1/payments/paystack/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const provider = paymentProvider();
  const raw = req.body as Buffer;
  if (!provider || provider.name !== 'PAYSTACK' || !Buffer.isBuffer(raw) || !provider.verifyWebhookSignature(raw, req.get('x-paystack-signature'))) {
    logger.warn({ ip: req.ip }, 'Rejected Paystack webhook (bad signature or payments not configured)');
    return res.status(401).end();
  }
  try {
    const event = JSON.parse(raw.toString('utf8')) as { event?: string; data?: { reference?: string } };
    if (event.event === 'charge.success' && event.data?.reference) {
      const charge = await provider.verify(event.data.reference);
      const result = await applySuccessfulCharge(charge);
      logger.info({ reference: event.data.reference, ...result }, 'Paystack charge.success processed');
    }
    res.status(200).end();
  } catch (err) {
    logger.error({ err }, 'Paystack webhook processing failed');
    res.status(500).end(); // Paystack retries
  }
});

export const paymentsRouter = Router();

/* ─────────────────────────── banks & payouts */

let bankCache: { at: number; banks: Bank[] } | null = null;
paymentsRouter.get('/payments/banks', requireAuth, async (_req, res) => {
  if (!bankCache || Date.now() - bankCache.at > 6 * 3_600_000) bankCache = { at: Date.now(), banks: await requireProvider().listBanks() };
  ok(res, bankCache.banks);
});

paymentsRouter.get('/organizations/:orgId/payouts', requireAuth, requireOrgPermission(orgId, 'MANAGE_BILLING'), async (req, res) => {
  const o = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId(req)! },
    select: { paystackSubaccountCode: true, payoutBankName: true, payoutAccountName: true, payoutAccountLast4: true, payoutsEnabledAt: true },
  });
  const { commissionRate } = await getSetting('commerce');
  const provider = paymentProvider();
  ok(res, {
    enabled: Boolean(o.paystackSubaccountCode),
    bankName: o.payoutBankName,
    accountName: o.payoutAccountName,
    accountLast4: o.payoutAccountLast4,
    enabledAt: o.payoutsEnabledAt,
    commissionRate,
    provider: provider?.name ?? null,
  });
});

paymentsRouter.post('/organizations/:orgId/payouts/resolve', requireAuth, requireOrgPermission(orgId, 'MANAGE_BILLING'), validateBody(payoutAccountSchema), async (req, res) => {
  const dto = req.body as PayoutAccountDto;
  ok(res, await requireProvider().resolveAccount(dto.accountNumber, dto.bankCode));
});

/** Connect (or replace) the bank account sales settle into. Only a masked copy is stored. */
paymentsRouter.put('/organizations/:orgId/payouts', requireAuth, requireOrgPermission(orgId, 'MANAGE_BILLING'), validateBody(payoutAccountSchema), async (req, res) => {
  const dto = req.body as PayoutAccountDto;
  const provider = requireProvider();
  const id = orgId(req)!;
  const org = await prisma.organization.findUniqueOrThrow({ where: { id }, select: { name: true } });
  const { accountName } = await provider.resolveAccount(dto.accountNumber, dto.bankCode);
  const banks = bankCache?.banks ?? (await provider.listBanks());
  const bankName = banks.find((b) => b.code === dto.bankCode)?.name ?? dto.bankCode;
  const { commissionRate } = await getSetting('commerce');
  const { subaccountCode } = await provider.createSubaccount({ businessName: org.name, bankCode: dto.bankCode, accountNumber: dto.accountNumber, percentageCharge: commissionRate * 100 });
  await prisma.organization.update({
    where: { id },
    data: { paystackSubaccountCode: subaccountCode, payoutBankCode: dto.bankCode, payoutBankName: bankName, payoutAccountName: accountName, payoutAccountLast4: dto.accountNumber.slice(-4), payoutsEnabledAt: new Date() },
  });
  await prisma.auditLog.create({ data: { actorId: req.auth!.userId, action: 'org.payouts_connected', entityType: 'Organization', entityId: id, metadata: { bankName, last4: dto.accountNumber.slice(-4), provider: provider.name } } });
  ok(res, { enabled: true, bankName, accountName, accountLast4: dto.accountNumber.slice(-4) });
});

/* ─────────────────────────── development-only mock checkout */

const mockOutcome = z.object({ outcome: z.enum(['success', 'failed']) });

paymentsRouter.post('/payments/mock/:reference/complete', validateBody(mockOutcome), async (req, res) => {
  const provider = paymentProvider();
  if (isProduction || provider?.name !== 'MOCK') throw AppError.notFound();
  const ref = String(req.params.reference);
  const payment = await prisma.payment.findUnique({ where: { providerRef: ref }, select: { amount: true, orderId: true } });
  if (!payment) throw AppError.notFound('Unknown payment reference');
  mockCharges.set(ref, { amountKobo: Math.round(Number(payment.amount) * 100), status: req.body.outcome === 'success' ? 'success' : 'failed' });
  // Simulate the webhook so the flow matches production.
  if (req.body.outcome === 'success') await applySuccessfulCharge(await provider.verify(ref));
  else await prisma.payment.update({ where: { providerRef: ref }, data: { status: 'FAILED' } });
  ok(res, { reference: ref, orderId: payment.orderId, outcome: req.body.outcome });
});
