import type { SizingResult } from '@solaris/solar-engine';

export type DesignStatus = 'DRAFT' | 'ESTIMATED' | 'REVIEW_REQUESTED' | 'INSTALLER_APPROVED' | 'ARCHIVED';

/** Prisma Decimal fields arrive as strings. */
export interface DesignSummary {
  id: string;
  title: string;
  status: DesignStatus;
  engineVersion: string;
  dailyKwh: string;
  arrayKw: string;
  panelCount: number;
  batteryKwh: string;
  inverterKva: string;
  estimatedCost: string;
  currency: string;
  createdAt: string;
  audit: { state: string; city: string | null };
}

export interface DesignDetail extends Omit<DesignSummary, 'audit'> {
  dataVersion: string;
  result: SizingResult;
  updatedAt: string;
}

export const STATUS_LABEL: Record<DesignStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-white/[0.06] text-ink-300' },
  ESTIMATED: { label: 'Estimate', className: 'bg-sun-400/15 text-sun-200' },
  REVIEW_REQUESTED: { label: 'Review requested', className: 'bg-sky-400/15 text-sky-200' },
  INSTALLER_APPROVED: { label: 'Installer approved', className: 'bg-volt-500/15 text-volt-300' },
  ARCHIVED: { label: 'Archived', className: 'bg-white/[0.06] text-ink-400' },
};
