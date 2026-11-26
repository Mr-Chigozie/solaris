import { z } from 'zod';

/* Quotations ------------------------------------------------------------ */

export const quoteLineInputSchema = z
  .object({
    kind: z.enum(['PRODUCT', 'SERVICE', 'CUSTOM']),
    productId: z.uuid().optional(),
    serviceId: z.uuid().optional(),
    description: z.string().trim().min(1, 'Describe this line').max(200),
    quantity: z.number().int().min(1).max(10_000),
    unitPrice: z.number().min(0).max(1_000_000_000),
  })
  .refine((l) => l.kind !== 'PRODUCT' || Boolean(l.productId), { message: 'Choose a product', path: ['productId'] })
  .refine((l) => l.kind !== 'SERVICE' || Boolean(l.serviceId), { message: 'Choose a service', path: ['serviceId'] });
export type QuoteLineInput = z.infer<typeof quoteLineInputSchema>;

export const quotationInputSchema = z.object({
  title: z.string().trim().max(140).optional(),
  lineItems: z.array(quoteLineInputSchema).min(1, 'Add at least one line').max(100),
  discount: z.number().min(0).max(1_000_000_000).default(0),
  applyVat: z.boolean().default(false),
  notes: z.string().trim().max(3000).optional(),
  validDays: z.number().int().min(1).max(90).optional(),
});
export type QuotationInputDto = z.infer<typeof quotationInputSchema>;

export const createQuotationSchema = quotationInputSchema.extend({
  conversationId: z.uuid(),
  /** false saves a draft only the business can see. */
  send: z.boolean().default(true),
});
export type CreateQuotationDto = z.infer<typeof createQuotationSchema>;

export const deliveryAddressSchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(20),
  addressLine: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(60),
  notes: z.string().trim().max(300).optional(),
});
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;

export const acceptQuotationSchema = z.object({
  /** The revision the customer is looking at — guards against accepting a stale quote. */
  revision: z.number().int().min(1),
  deliveryAddress: deliveryAddressSchema,
});

export const rejectQuotationSchema = z.object({ reason: z.string().trim().max(500).optional() });

export const quotationListSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

/* Orders ---------------------------------------------------------------- */

export const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED'] as const;
export type OrderStatusName = (typeof ORDER_STATUSES)[number];

/** Statuses a seller may move an order to, from each status. Payment and completion are system/customer-driven. */
export const SELLER_TRANSITIONS: Partial<Record<OrderStatusName, OrderStatusName[]>> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING'],
  PROCESSING: ['READY', 'SHIPPED'],
  READY: ['SHIPPED', 'DELIVERED'],
  SHIPPED: ['DELIVERED'],
};

export const ORDER_STATUS_LABEL: Record<OrderStatusName, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  PROCESSING: 'Processing',
  READY: 'Ready for pickup / installation',
  SHIPPED: 'Out for delivery',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  DISPUTED: 'Disputed',
};

export const orderStatusUpdateSchema = z.object({
  status: z.enum(['PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  note: z.string().trim().max(500).optional(),
});

export const cancelOrderSchema = z.object({ reason: z.string().trim().max(500).optional() });

export const orderListSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const verifyPaymentSchema = z.object({ reference: z.string().trim().min(6).max(100) });

/* Payouts --------------------------------------------------------------- */

export const payoutAccountSchema = z.object({
  bankCode: z.string().trim().min(2).max(20),
  accountNumber: z.string().trim().regex(/^\d{10}$/, 'Nigerian account numbers (NUBAN) are 10 digits'),
});
export type PayoutAccountDto = z.infer<typeof payoutAccountSchema>;
