/**
 * Seed reference data and the first platform administrator.
 * Idempotent — safe to run repeatedly.
 */
import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { APPLIANCE_CATALOG } from '@solaris/solar-engine';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  for (const [index, a] of APPLIANCE_CATALOG.entries()) {
    const data = {
      sortOrder: index * 10,
      name: a.name,
      category: a.category,
      defaultWatts: a.defaultWatts,
      surgeFactor: a.surgeFactor,
      typicalHoursPerDay: a.typicalHoursPerDay,
      typicalNightFraction: a.typicalNightFraction,
      note: a.note ?? null,
    };
    await prisma.appliance.upsert({ where: { id: a.id }, create: { id: a.id, ...data }, update: data });
  }
  console.log(`✔ ${APPLIANCE_CATALOG.length} appliances`);

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({
        where: { email },
        data: {
          roles: existing.roles.includes('ADMIN') ? undefined : { push: 'ADMIN' },
          adminRoles: existing.adminRoles.includes('SUPER_ADMIN') ? undefined : { push: 'SUPER_ADMIN' },
        },
      });
      console.log(`✔ admin ${email} (existing)`);
    } else {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hash(password, { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 }),
          firstName: 'Platform',
          lastName: 'Admin',
          roles: ['ADMIN'],
          adminRoles: ['SUPER_ADMIN'],
          emailVerifiedAt: new Date(),
          termsAcceptedAt: new Date(),
        },
      });
      console.log(`✔ admin ${email} (created — change this password)`);
    }
  } else {
    console.log('• SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin user');
  }

  // SOLARIS trades on its own marketplace as an ordinary participant — same
  // storefront, same rules, clearly labelled as platform-owned.
  const platformSlug = 'solaris';
  const platform = await prisma.organization.upsert({
    where: { slug: platformSlug },
    update: {},
    create: {
      name: 'SOLARIS',
      slug: platformSlug,
      types: ['VENDOR', 'INSTALLER'],
      isPlatformOwned: true,
      verification: 'VERIFIED',
      verifiedAt: new Date(),
      tagline: 'Official SOLARIS store and services',
      serviceStates: [],
      subscription: { create: { plan: 'ENTERPRISE' } },
    },
  });
  if (email) {
    const admin = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (admin) {
      await prisma.organizationMember.upsert({
        where: { userId_organizationId: { userId: admin.id, organizationId: platform.id } },
        update: {},
        create: { userId: admin.id, organizationId: platform.id, role: 'OWNER' },
      });
    }
  }
  console.log('✔ SOLARIS platform organisation');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
