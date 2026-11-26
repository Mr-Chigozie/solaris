import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { ENGINE_VERSION } from '@solaris/solar-engine';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { errorHandler, notFound } from './middleware/error-handler';
import { globalLimiter } from './middleware/rate-limit';
import { adminRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { calculatorRouter } from './modules/calculator/calculator.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { designsRouter } from './modules/designs/designs.routes';
import { organizationsRouter } from './modules/organizations/organizations.routes';
import { maintenanceGate, siteRouter } from './modules/settings/site.routes';
import { businessRouter } from './modules/business/business.routes';
import { marketplaceRouter } from './modules/marketplace/marketplace.routes';
import { messagingRouter } from './modules/messaging/messaging.routes';
import { uploadsRouter, uploadsStatic } from './modules/uploads/uploads.routes';
import { ordersRouter } from './modules/commerce/orders.routes';
import { quotationsRouter } from './modules/commerce/quotations.routes';
import { paymentsRouter, paystackWebhook } from './modules/payments/payments.routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind one proxy (Render/Railway/Vercel) — needed for correct client IPs
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
    }),
  );
  // Payment webhooks need the raw body for signature checks — mount before the JSON parser.
  app.use(paystackWebhook);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  // Uploaded images (local-disk storage driver). Served with image-only headers.
  app.use('/uploads', uploadsStatic);

  app.get('/health', async (_req, res) => {
    let database: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    res.status(200).json({ status: 'ok', database, engineVersion: ENGINE_VERSION, time: new Date().toISOString() });
  });

  const v1 = Router();
  v1.use(globalLimiter);
  v1.use(maintenanceGate);
  v1.use(siteRouter);
  v1.use('/auth', authRouter);
  v1.use(catalogRouter);
  v1.use(calculatorRouter);
  v1.use(designsRouter);
  v1.use(organizationsRouter);
  v1.use(businessRouter);
  v1.use(marketplaceRouter);
  v1.use(messagingRouter);
  v1.use(uploadsRouter);
  v1.use(quotationsRouter);
  v1.use(ordersRouter);
  v1.use(paymentsRouter);
  v1.use(adminRouter);

  app.use('/api/v1', v1);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
