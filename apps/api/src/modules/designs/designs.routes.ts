import { Router } from 'express';
import { calculateSystem, type SizingInput } from '@solaris/solar-engine';
import { paginationSchema, saveDesignSchema, type SaveDesignDto } from '@solaris/validation';
import { requireAuth } from '../../middleware/auth';
import { parseQuery, validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';
import { getSetting } from '../settings/settings.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const designsRouter = Router();
designsRouter.use('/solar/designs', requireAuth);

const summarySelect = {
  id: true,
  title: true,
  status: true,
  engineVersion: true,
  dailyKwh: true,
  arrayKw: true,
  panelCount: true,
  batteryKwh: true,
  inverterKva: true,
  estimatedCost: true,
  currency: true,
  createdAt: true,
  audit: { select: { state: true, city: true } },
} as const;

/** Load a design only if it belongs to the caller — never leak existence of others'. */
async function findOwnDesign(id: string | string[] | undefined, userId: string) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw AppError.notFound('Design not found');
  const design = await prisma.solarDesign.findFirst({ where: { id, userId } });
  if (!design) throw AppError.notFound('Design not found');
  return design;
}

function headline(result: ReturnType<typeof calculateSystem>) {
  return {
    engineVersion: result.engineVersion,
    dataVersion: result.dataVersion,
    dailyKwh: result.energy.dailyKwh,
    arrayKw: result.solar.installedArrayKw,
    panelCount: result.solar.panelCount,
    batteryKwh: result.battery.configuration?.installedNominalKwh ?? 0,
    inverterKva: result.inverter.recommendedKva,
    estimatedCost: result.cost.total,
  };
}

/** Run the engine on the submitted input and save audit + design together. */
designsRouter.post('/solar/designs', validateBody(saveDesignSchema), async (req, res) => {
  const { title, ...input } = req.body as SaveDesignDto;
  const userId = req.auth!.userId;
  const result = calculateSystem({ ...input, referencePrices: await getSetting('pricing') });

  const design = await prisma.$transaction(async (tx) => {
    const audit = await tx.energyAudit.create({
      data: {
        userId,
        state: result.location.state,
        city: input.location.city,
        gridAvailable: input.gridAvailable,
        backupHours: input.backupHours,
        autonomyDays: input.autonomyDays,
        dailyKwh: result.energy.dailyKwh,
        peakLoadW: result.energy.peakLoadW,
        items: {
          create: input.appliances.map((a) => ({
            applianceId: a.catalogId ?? null,
            applianceName: a.name,
            quantity: a.quantity,
            wattage: a.watts,
            hoursPerDay: a.hoursPerDay,
            nightHoursPerDay: a.nightHoursPerDay,
            simultaneous: a.simultaneousUse ?? true,
            surgeFactor: a.surgeFactor,
          })),
        },
      },
    });

    return tx.solarDesign.create({
      data: {
        userId,
        auditId: audit.id,
        title,
        status: 'ESTIMATED',
        input: input as object,
        assumptions: result.assumptions as object,
        result: result as object,
        ...headline(result),
      },
      select: { id: true },
    });
  });

  ok(res, { id: design.id, result }, 201);
});

designsRouter.get('/solar/designs', async (req, res) => {
  const { page, pageSize } = parseQuery(paginationSchema, req);
  const where = { userId: req.auth!.userId, status: { not: 'ARCHIVED' as const } };
  const [items, total] = await prisma.$transaction([
    prisma.solarDesign.findMany({ where, select: summarySelect, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.solarDesign.count({ where }),
  ]);
  ok(res, items, 200, { page, pageSize, total });
});

designsRouter.get('/solar/designs/:id', async (req, res) => {
  const design = await findOwnDesign(req.params.id, req.auth!.userId);
  ok(res, design);
});

/**
 * Re-run a saved design with the current engine version. The previous result is
 * returned alongside so the client can show what changed; the stored design is updated.
 */
designsRouter.post('/solar/designs/:id/recalculate', async (req, res) => {
  const design = await findOwnDesign(req.params.id, req.auth!.userId);
  if (design.status === 'INSTALLER_APPROVED') {
    throw AppError.conflict('Installer-approved designs are frozen. Create a new design instead.');
  }
  const result = calculateSystem({ ...(design.input as unknown as SizingInput), referencePrices: await getSetting('pricing') });
  await prisma.solarDesign.update({
    where: { id: design.id },
    data: { result: result as object, assumptions: result.assumptions as object, status: 'ESTIMATED', ...headline(result) },
  });
  ok(res, { id: design.id, previous: { engineVersion: design.engineVersion, dataVersion: design.dataVersion }, result });
});

designsRouter.post('/solar/designs/:id/request-review', async (req, res) => {
  const design = await findOwnDesign(req.params.id, req.auth!.userId);
  if (design.status === 'REVIEW_REQUESTED') return ok(res, { id: design.id, status: design.status });
  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.solarDesign.update({ where: { id: design.id }, data: { status: 'REVIEW_REQUESTED' }, select: { id: true, status: true } });
    await tx.auditLog.create({ data: { actorId: req.auth!.userId, action: 'design.review_requested', entityType: 'SolarDesign', entityId: design.id } });
    return d;
  });
  ok(res, updated);
});

designsRouter.delete('/solar/designs/:id', async (req, res) => {
  const design = await findOwnDesign(req.params.id, req.auth!.userId);
  await prisma.solarDesign.update({ where: { id: design.id }, data: { status: 'ARCHIVED' } });
  ok(res, { id: design.id, archived: true });
});
