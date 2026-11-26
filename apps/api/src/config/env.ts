import { z } from '@solaris/validation';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(5000),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
    DATABASE_URL: z.string().default('postgresql://solaris:solaris@localhost:5432/solaris'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters').default('dev-only-insecure-secret-change-me-0123456789'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_ACCESS_SECRET.includes('change-me')) {
      ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'Set a real secret in production' });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
