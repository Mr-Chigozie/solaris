import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { conversationListSchema, sendMessageSchema, startConversationSchema, type StartConversationDto } from '@solaris/validation';
import { memberHasPermission, requireAuth } from '../../middleware/auth';
import { parseQuery, validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';

/**
 * Customer ↔ business messaging. A conversation belongs to one customer and one
 * business; any staff member of that business holding MESSAGE_CUSTOMERS can read
 * and reply. Nobody else can see it — non-participants get 404.
 */
export const messagingRouter = Router();
messagingRouter.use('/conversations', requireAuth);

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'You are sending messages too quickly.' } },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function canActForBusiness(userId: string, organizationId: string) {
  const m = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true, permissions: true },
  });
  return Boolean(m && memberHasPermission(m, 'MESSAGE_CUSTOMERS'));
}

/** Resolve the caller's side of a conversation, or 404 if they are not a participant. */
async function participant(conversationId: unknown, userId: string) {
  if (typeof conversationId !== 'string' || !UUID_RE.test(conversationId)) throw AppError.notFound('Conversation not found');
  const c = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!c) throw AppError.notFound('Conversation not found');
  if (c.customerId === userId) return { conversation: c, side: 'customer' as const };
  if (await canActForBusiness(userId, c.organizationId)) return { conversation: c, side: 'business' as const };
  throw AppError.notFound('Conversation not found');
}

/** Validate that a context (product, service, design) is legitimate for this thread. */
async function assertContext(dto: StartConversationDto, customerId: string) {
  if (dto.contextType === 'GENERAL' || !dto.contextId) return;
  if (dto.contextType === 'PRODUCT') {
    const p = await prisma.product.findFirst({ where: { id: dto.contextId, organizationId: dto.organizationId, status: 'PUBLISHED', deletedAt: null } });
    if (!p) throw AppError.badRequest('That product is not available from this business');
  } else if (dto.contextType === 'SERVICE') {
    const s = await prisma.service.findFirst({ where: { id: dto.contextId, organizationId: dto.organizationId, status: 'PUBLISHED', deletedAt: null } });
    if (!s) throw AppError.badRequest('That service is not available from this business');
  } else if (dto.contextType === 'DESIGN') {
    // Sharing your own design with a business is an explicit act; nobody can share someone else's.
    const d = await prisma.solarDesign.findFirst({ where: { id: dto.contextId, userId: customerId } });
    if (!d) throw AppError.badRequest('Design not found');
  }
}

/** Start a conversation (or continue the existing one about the same thing). */
messagingRouter.post('/conversations', messageLimiter, validateBody(startConversationSchema), async (req, res) => {
  const dto = req.body as StartConversationDto;
  const userId = req.auth!.userId;

  const org = await prisma.organization.findFirst({
    where: { id: dto.organizationId, verification: 'VERIFIED', hiddenAt: null, deletedAt: null },
    select: { id: true },
  });
  if (!org) throw AppError.notFound('Business not found');
  const ownMember = await prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: org.id } } });
  if (ownMember) throw AppError.badRequest('You cannot message your own business');
  await assertContext(dto, userId);

  const conversation = await prisma.$transaction(async (tx) => {
    const existing = await tx.conversation.findFirst({
      where: { customerId: userId, organizationId: org.id, contextType: dto.contextType, contextId: dto.contextId ?? null },
    });
    const now = new Date();
    const c = existing
      ? await tx.conversation.update({ where: { id: existing.id }, data: { lastMessageAt: now, customerReadAt: now } })
      : await tx.conversation.create({
          data: { customerId: userId, organizationId: org.id, subject: dto.subject, contextType: dto.contextType, contextId: dto.contextId, lastMessageAt: now, customerReadAt: now },
        });
    await tx.message.create({ data: { conversationId: c.id, senderId: userId, fromBusiness: false, body: dto.message } });
    return c;
  });

  ok(res, { id: conversation.id }, 201);
});

/** Inbox: "customer" (threads I started) or a business id I can message for. */
messagingRouter.get('/conversations', async (req, res) => {
  const { inbox, page, pageSize } = parseQuery(conversationListSchema, req);
  const userId = req.auth!.userId;
  const asBusiness = inbox !== 'customer';
  if (asBusiness && !(await canActForBusiness(userId, inbox))) throw AppError.forbidden();

  const where = asBusiness ? { organizationId: inbox } : { customerId: userId };
  const rows = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      organization: { select: { id: true, name: true, slug: true, logoUrl: true, isPlatformOwned: true } },
      customer: { select: { firstName: true, lastName: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, fromBusiness: true, createdAt: true } },
    },
  });

  ok(
    res,
    rows.map((c) => {
      const last = c.messages[0];
      const readAt = asBusiness ? c.businessReadAt : c.customerReadAt;
      const fromOtherSide = last ? last.fromBusiness !== asBusiness : false;
      return {
        id: c.id,
        subject: c.subject,
        contextType: c.contextType,
        lastMessageAt: c.lastMessageAt,
        lastMessage: last ? { body: last.body.slice(0, 160), fromBusiness: last.fromBusiness, createdAt: last.createdAt } : null,
        unread: Boolean(last && fromOtherSide && (!readAt || readAt < last.createdAt)),
        organization: c.organization,
        // Businesses see the customer's name only — contact details are shared in the chat if the customer chooses.
        customer: asBusiness ? c.customer : undefined,
      };
    }),
    200,
    { page, pageSize },
  );
});

/** Unread counts for badges: my customer inbox and each business inbox I serve. */
messagingRouter.get('/conversations/unread-count', async (req, res) => {
  const userId = req.auth!.userId;
  const memberships = await prisma.organizationMember.findMany({ where: { userId }, select: { organizationId: true, role: true, permissions: true } });
  const orgIds = memberships.filter((m) => memberHasPermission(m, 'MESSAGE_CUSTOMERS')).map((m) => m.organizationId);

  const unreadFor = async (where: object, side: 'customer' | 'business') => {
    const threads = await prisma.conversation.findMany({
      where,
      select: { customerReadAt: true, businessReadAt: true, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { fromBusiness: true, createdAt: true } } },
    });
    return threads.filter((t) => {
      const last = t.messages[0];
      if (!last || last.fromBusiness === (side === 'business')) return false;
      const readAt = side === 'business' ? t.businessReadAt : t.customerReadAt;
      return !readAt || readAt < last.createdAt;
    }).length;
  };

  const customer = await unreadFor({ customerId: userId }, 'customer');
  const businesses: Record<string, number> = {};
  for (const id of orgIds) businesses[id] = await unreadFor({ organizationId: id }, 'business');
  ok(res, { customer, businesses, total: customer + Object.values(businesses).reduce((a, b) => a + b, 0) });
});

/** Thread with messages and its context (product / service / shared design). */
messagingRouter.get('/conversations/:id', async (req, res) => {
  const { conversation: c, side } = await participant(req.params.id, req.auth!.userId);
  const [messages, organization, customer] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: c.id },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: { id: true, body: true, fromBusiness: true, kind: true, refId: true, createdAt: true, sender: { select: { firstName: true, lastName: true } } },
    }),
    prisma.organization.findUnique({ where: { id: c.organizationId }, select: { id: true, name: true, slug: true, logoUrl: true, isPlatformOwned: true, verification: true } }),
    prisma.user.findUnique({ where: { id: c.customerId }, select: { firstName: true, lastName: true } }),
  ]);

  let context: Record<string, unknown> | null = null;
  if (c.contextId) {
    if (c.contextType === 'PRODUCT') {
      const p = await prisma.product.findUnique({ where: { id: c.contextId }, select: { id: true, name: true, slug: true, price: true, images: true } });
      if (p) context = { type: 'PRODUCT', ...p, price: p.price === null ? null : Number(p.price), orgSlug: organization?.slug };
    } else if (c.contextType === 'SERVICE') {
      const s = await prisma.service.findUnique({ where: { id: c.contextId }, select: { id: true, title: true, priceType: true, price: true } });
      if (s) context = { type: 'SERVICE', ...s, price: s.price === null ? null : Number(s.price) };
    } else if (c.contextType === 'DESIGN') {
      const d = await prisma.solarDesign.findUnique({
        where: { id: c.contextId },
        select: { id: true, title: true, dailyKwh: true, arrayKw: true, panelCount: true, batteryKwh: true, inverterKva: true, estimatedCost: true, audit: { select: { state: true, city: true } } },
      });
      if (d) {
        context = {
          type: 'DESIGN', id: d.id, title: d.title, state: d.audit.state, city: d.audit.city, panelCount: d.panelCount,
          dailyKwh: Number(d.dailyKwh), arrayKw: Number(d.arrayKw), batteryKwh: Number(d.batteryKwh), inverterKva: Number(d.inverterKva), estimatedCost: Number(d.estimatedCost),
        };
      }
    }
  }

  ok(res, {
    id: c.id,
    subject: c.subject,
    contextType: c.contextType,
    side,
    organization,
    customer,
    context,
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      fromBusiness: m.fromBusiness,
      kind: m.kind,
      refId: m.refId,
      createdAt: m.createdAt,
      // Customers see the business, not which staff member replied.
      senderName: m.fromBusiness ? (side === 'business' ? `${m.sender.firstName} ${m.sender.lastName}` : organization?.name) : `${m.sender.firstName} ${m.sender.lastName}`,
      mine: (side === 'business') === m.fromBusiness,
    })),
  });
});

messagingRouter.post('/conversations/:id/messages', messageLimiter, validateBody(sendMessageSchema), async (req, res) => {
  const userId = req.auth!.userId;
  const { conversation: c, side } = await participant(req.params.id, userId);
  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.message.create({ data: { conversationId: c.id, senderId: userId, fromBusiness: side === 'business', body: req.body.body } });
    await tx.conversation.update({ where: { id: c.id }, data: { lastMessageAt: now, ...(side === 'business' ? { businessReadAt: now } : { customerReadAt: now }) } });
    return m;
  });
  ok(res, { id: message.id, body: message.body, fromBusiness: message.fromBusiness, createdAt: message.createdAt, mine: true }, 201);
});

messagingRouter.post('/conversations/:id/read', async (req, res) => {
  const { conversation: c, side } = await participant(req.params.id, req.auth!.userId);
  await prisma.conversation.update({ where: { id: c.id }, data: side === 'business' ? { businessReadAt: new Date() } : { customerReadAt: new Date() } });
  ok(res, { id: c.id, read: true });
});
