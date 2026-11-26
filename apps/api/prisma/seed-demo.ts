/**
 * DEVELOPMENT DEMO DATA — never run against production.
 *
 *   npm run db:seed:demo -w @solaris/api            create / refresh demo businesses
 *   npm run db:seed:demo -w @solaris/api -- --remove delete them again
 *
 * Creates two clearly labelled "Demo" businesses (a vendor and an installer)
 * with listings and their own logins, so both sides of the marketplace and
 * messaging can be tested locally. Prices are illustrative, not market data.
 */
import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data in production.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const PASSWORD = 'DemoSolar2026';
const DEMO_EMAILS = ['vendor@demo.solaris.local', 'installer@demo.solaris.local'];
const DEMO_SLUGS = ['demo-lagos-solar-supplies', 'demo-abuja-solar-installers'];

async function remove() {
  const orgs = await prisma.organization.findMany({ where: { slug: { in: DEMO_SLUGS } }, select: { id: true } });
  const orgIds = orgs.map((o) => o.id);
  await prisma.conversation.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.product.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.service.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  const users = await prisma.user.findMany({ where: { email: { in: DEMO_EMAILS } }, select: { id: true } });
  await prisma.message.deleteMany({ where: { senderId: { in: users.map((u) => u.id) } } });
  await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
  console.log(`✔ removed ${orgIds.length} demo businesses and ${users.length} demo users`);
}

async function owner(email: string, firstName: string, role: 'VENDOR' | 'INSTALLER') {
  const passwordHash = await hash(PASSWORD, { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, firstName, lastName: 'Demo', roles: ['CONSUMER', role], termsAcceptedAt: new Date(), emailVerifiedAt: new Date() },
  });
}

async function seed() {
  await remove();
  const allStates = ['Lagos', 'Ogun', 'Oyo', 'Osun', 'Ekiti', 'Ondo', 'Edo', 'Delta', 'Rivers', 'Federal Capital Territory', 'Kaduna', 'Kano'];

  const v = await owner(DEMO_EMAILS[0]!, 'Tola', 'VENDOR');
  const vendor = await prisma.organization.create({
    data: {
      name: 'Demo — Lagos Solar Supplies',
      slug: DEMO_SLUGS[0]!,
      types: ['VENDOR'],
      verification: 'VERIFIED',
      verifiedAt: new Date(),
      verificationNote: 'Demo data',
      tagline: 'Tier-1 panels, hybrid inverters & lithium batteries — delivered across the South-West',
      description:
        'DEMO BUSINESS for local testing. We stock mono PERC and N-type panels, hybrid inverters from 3.5 to 10 kVA and LiFePO4 batteries, with delivery from our Ikeja warehouse.',
      state: 'Lagos',
      city: 'Ikeja',
      phone: '+2348030000001',
      serviceStates: allStates,
      yearsInBusiness: 6,
      cacNumber: 'RC 0000001',
      memberships: { create: { userId: v.id, role: 'OWNER' } },
      subscription: { create: { plan: 'FREE' } },
    },
  });

  const products: Array<{ name: string; category: 'SOLAR_PANEL' | 'INVERTER' | 'BATTERY' | 'CHARGE_CONTROLLER' | 'MOUNTING' | 'CABLE_AND_PROTECTION'; brand: string; price: number; stock: number; specs: Record<string, string | number>; featured?: boolean }> = [
    { name: '550W Mono PERC Solar Panel', category: 'SOLAR_PANEL', brand: 'Jinko', price: 165_000, stock: 120, specs: { watts: 550, cellType: 'Mono PERC', efficiency: 21.3, warrantyYears: 12 }, featured: true },
    { name: '450W Mono Half-Cell Solar Panel', category: 'SOLAR_PANEL', brand: 'Canadian Solar', price: 135_000, stock: 64, specs: { watts: 450, cellType: 'Mono half-cell', efficiency: 20.6, warrantyYears: 12 } },
    { name: '5kVA 48V Hybrid Inverter', category: 'INVERTER', brand: 'Growatt', price: 850_000, stock: 18, specs: { kva: 5, batteryVoltage: 48, inverterType: 'Hybrid', mpptAmps: 100, warrantyYears: 2 }, featured: true },
    { name: '3.5kVA 24V Hybrid Inverter', category: 'INVERTER', brand: 'Felicity', price: 520_000, stock: 25, specs: { kva: 3.5, batteryVoltage: 24, inverterType: 'Hybrid', mpptAmps: 80, warrantyYears: 2 } },
    { name: '10kVA 48V Hybrid Inverter', category: 'INVERTER', brand: 'Deye', price: 1_650_000, stock: 6, specs: { kva: 10, batteryVoltage: 48, inverterType: 'Hybrid', mpptAmps: 200, warrantyYears: 5 } },
    { name: '5.12kWh 48V LiFePO4 Battery', category: 'BATTERY', brand: 'Pylontech', price: 1_750_000, stock: 30, specs: { kwh: 5.12, voltage: 51.2, ah: 100, chemistry: 'LiFePO4', cycles: 6000, warrantyYears: 5 }, featured: true },
    { name: '2.56kWh 24V LiFePO4 Battery', category: 'BATTERY', brand: 'Felicity', price: 950_000, stock: 4, specs: { kwh: 2.56, voltage: 25.6, ah: 100, chemistry: 'LiFePO4', cycles: 4000, warrantyYears: 3 } },
    { name: '220Ah 12V Tubular Battery', category: 'BATTERY', brand: 'Luminous', price: 360_000, stock: 40, specs: { kwh: 2.64, voltage: 12, ah: 220, chemistry: 'Tubular lead-acid', cycles: 1500, warrantyYears: 2 } },
    { name: '60A MPPT Charge Controller', category: 'CHARGE_CONTROLLER', brand: 'Victron', price: 180_000, stock: 12, specs: { amps: 60, voltage: 48, controllerType: 'MPPT' } },
    { name: 'Roof Mounting Kit (4 panels)', category: 'MOUNTING', brand: 'Generic', price: 45_000, stock: 50, specs: { material: 'Anodised aluminium' } },
    { name: 'DC Breaker & Surge Protection Kit', category: 'CABLE_AND_PROTECTION', brand: 'Chint', price: 65_000, stock: 35, specs: { rating: '63A DC breaker + 1000V SPD' } },
  ];
  for (const [i, p] of products.entries()) {
    await prisma.product.create({
      data: {
        organizationId: vendor.id,
        slug: `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-demo${i}`,
        name: p.name,
        category: p.category,
        brand: p.brand,
        price: p.price,
        stockQuantity: p.stock,
        specifications: p.specs,
        description: 'Demo listing for local testing. Specifications and prices are illustrative.',
        status: 'PUBLISHED',
        isFeatured: Boolean(p.featured),
      },
    });
  }

  const ins = await owner(DEMO_EMAILS[1]!, 'Musa', 'INSTALLER');
  const installer = await prisma.organization.create({
    data: {
      name: 'Demo — Abuja Solar Installers',
      slug: DEMO_SLUGS[1]!,
      types: ['INSTALLER', 'VENDOR'],
      verification: 'VERIFIED',
      verifiedAt: new Date(),
      verificationNote: 'Demo data',
      tagline: 'Certified hybrid & off-grid installations in FCT, Niger, Nasarawa and Kaduna',
      description: 'DEMO BUSINESS for local testing. Site surveys, system design, installation and maintenance for homes, offices and filling stations.',
      state: 'Federal Capital Territory',
      city: 'Gwarinpa',
      phone: '+2348030000002',
      serviceStates: ['Federal Capital Territory', 'Niger', 'Nasarawa', 'Kaduna', 'Kogi'],
      yearsInBusiness: 9,
      cacNumber: 'RC 0000002',
      memberships: { create: { userId: ins.id, role: 'OWNER' } },
      subscription: { create: { plan: 'FREE' } },
    },
  });
  const services: Array<{ title: string; category: 'SITE_SURVEY' | 'INSTALLATION' | 'MAINTENANCE' | 'BATTERY_REPLACEMENT' | 'SYSTEM_DESIGN'; priceType: 'FIXED' | 'FROM' | 'ON_QUOTE'; price: number | null; description: string }> = [
    { title: 'Site survey & load assessment', category: 'SITE_SURVEY', priceType: 'FIXED', price: 25_000, description: 'On-site visit, roof assessment, load audit and written recommendation within 48 hours.' },
    { title: 'Hybrid system design review', category: 'SYSTEM_DESIGN', priceType: 'FIXED', price: 15_000, description: 'We review your SOLARIS design against your site and equipment datasheets and send an approved design.' },
    { title: '3.5–5kVA hybrid installation', category: 'INSTALLATION', priceType: 'FROM', price: 250_000, description: 'Full installation with mounting, DC/AC protection, earthing and commissioning. 12-month workmanship warranty.' },
    { title: 'Quarterly maintenance visit', category: 'MAINTENANCE', priceType: 'FROM', price: 30_000, description: 'Panel cleaning, torque checks, battery health test and firmware updates.' },
    { title: 'Battery bank replacement', category: 'BATTERY_REPLACEMENT', priceType: 'ON_QUOTE', price: null, description: 'Swap tubular banks for LiFePO4, including inverter settings changes.' },
  ];
  for (const s of services) await prisma.service.create({ data: { ...s, organizationId: installer.id, status: 'PUBLISHED' } });

  console.log('✔ demo businesses created');
  console.log(`  Vendor login:    ${DEMO_EMAILS[0]} / ${PASSWORD}`);
  console.log(`  Installer login: ${DEMO_EMAILS[1]} / ${PASSWORD}`);
}

(process.argv.includes('--remove') ? remove() : seed())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
