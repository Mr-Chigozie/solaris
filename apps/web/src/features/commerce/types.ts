import { ORDER_STATUS_LABEL, type DeliveryAddress, type OrderStatusName } from '@solaris/validation';

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';

export interface QuoteLine {
  kind: 'PRODUCT' | 'SERVICE' | 'CUSTOM';
  productId: string | null;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  snapshot: { name?: string; title?: string; brand?: string | null; image?: string | null; listPrice?: number | null } | null;
}

export interface QuoteRevision {
  id: string;
  revision: number;
  lineItems: QuoteLine[];
  subtotal: number;
  discount: number;
  vatRate: number;
  tax: number;
  total: number;
  notes: string | null;
  validUntil: string | null;
  createdAt: string;
}

export interface QuoteDetail {
  id: string;
  reference: string;
  title: string | null;
  status: QuoteStatus;
  currentRevision: number;
  expiresAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectionReason: string | null;
  conversationId: string | null;
  side: 'customer' | 'business';
  canManage: boolean;
  organization: { id: string; name: string; slug: string; logoUrl: string | null; phone: string | null; email: string | null; state: string | null; city: string | null; verification: string; isPlatformOwned: boolean; cacNumber: string | null; acceptsOnlinePayment: boolean };
  customer: { firstName: string; lastName: string };
  order: { id: string; reference: string; status: OrderStatusName } | null;
  revisions: QuoteRevision[];
  createdAt: string;
}

export interface QuoteSummary {
  id: string;
  reference: string;
  title: string | null;
  status: QuoteStatus;
  total: number | null;
  currentRevision: number;
  expiresAt: string | null;
  updatedAt: string;
  organization?: { id: string; name: string; slug: string; logoUrl: string | null };
  customer?: { firstName: string; lastName: string };
  order: { id: string; reference: string; status: OrderStatusName } | null;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  snapshot: { image?: string | null; name?: string; title?: string } | null;
}

export interface OrderDetail {
  id: string;
  reference: string;
  status: OrderStatusName;
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  commissionRate: number;
  commissionAmount: number;
  sellerReceives?: number;
  deliveryAddress: DeliveryAddress | null;
  notes: string | null;
  paidAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  side: 'customer' | 'business';
  canManage: boolean;
  allowedTransitions: OrderStatusName[];
  organization: { id: string; name: string; slug: string; logoUrl: string | null; phone: string | null; acceptsOnlinePayment: boolean };
  customer: { firstName: string; lastName: string };
  quotation: { id: string; reference: string; conversationId: string | null } | null;
  items: OrderItem[];
  events: Array<{ id: string; status: OrderStatusName; note: string | null; createdAt: string }>;
  payments: Array<{ providerRef: string; status: 'INITIATED' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED'; amount: number; provider: string; channel: string | null; paidAt: string | null; createdAt: string }>;
}

export interface OrderSummary {
  id: string;
  reference: string;
  status: OrderStatusName;
  total: number;
  createdAt: string;
  organization?: { id: string; name: string; slug: string; logoUrl: string | null };
  customer?: { firstName: string; lastName: string };
  _count: { items: number };
}

export const QUOTE_STATUS_STYLE: Record<QuoteStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-white/[0.06] text-ink-300' },
  SENT: { label: 'Awaiting response', className: 'bg-sun-400/15 text-sun-200' },
  ACCEPTED: { label: 'Accepted', className: 'bg-volt-500/15 text-volt-300' },
  REJECTED: { label: 'Declined', className: 'bg-red-500/15 text-red-200' },
  EXPIRED: { label: 'Expired', className: 'bg-white/[0.06] text-ink-400' },
  WITHDRAWN: { label: 'Withdrawn', className: 'bg-white/[0.06] text-ink-400' },
};

export const ORDER_STATUS_STYLE: Record<OrderStatusName, string> = {
  PENDING_PAYMENT: 'bg-sun-400/15 text-sun-200',
  PAID: 'bg-volt-500/15 text-volt-300',
  PROCESSING: 'bg-sky-500/15 text-sky-200',
  READY: 'bg-sky-500/15 text-sky-200',
  SHIPPED: 'bg-sky-500/15 text-sky-200',
  DELIVERED: 'bg-volt-500/15 text-volt-300',
  COMPLETED: 'bg-volt-500/20 text-volt-200',
  CANCELLED: 'bg-white/[0.06] text-ink-400',
  REFUNDED: 'bg-white/[0.06] text-ink-400',
  DISPUTED: 'bg-red-500/15 text-red-200',
};

export const orderStatusLabel = (s: OrderStatusName) => ORDER_STATUS_LABEL[s];
