'use client';

import { useState } from 'react';
import { SettingsEditor } from '@/features/admin/settings-editor';
import { SectionTabs } from '@/features/admin/section-tabs';

const SECTIONS = [
  { key: 'content.home', label: 'Homepage', title: 'Homepage content', description: 'Hero, statistics, how it works, audiences, trust section and closing call to action. Layout and icons stay consistent; all wording is yours.' },
  { key: 'announcement', label: 'Announcement banner', title: 'Announcement banner', description: 'A dismissible banner shown above the site header on every public page.' },
  { key: 'content.footer', label: 'Footer', title: 'Footer', description: 'The short description and legal disclaimer shown at the bottom of every public page.' },
] as const;

export default function AdminContentPage() {
  const [active, setActive] = useState<(typeof SECTIONS)[number]['key']>('content.home');
  const section = SECTIONS.find((s) => s.key === active)!;

  return (
    <div>
      <SectionTabs items={SECTIONS.map((s) => [s.key, s.label])} active={active} onChange={(k) => setActive(k as typeof active)} />
      <SettingsEditor key={section.key} settingKey={section.key} title={section.title} description={section.description} />
    </div>
  );
}
