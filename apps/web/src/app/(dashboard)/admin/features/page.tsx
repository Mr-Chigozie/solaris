'use client';

import { AlertTriangle } from 'lucide-react';
import { SettingsEditor } from '@/features/admin/settings-editor';

export default function AdminFeaturesPage() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-2xl border border-sun-400/25 bg-sun-400/[0.06] p-4 text-sm text-sun-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sun-400" />
        <p>
          Toggles are enforced by the API, not just hidden in the interface. Turning off a sign-up type rejects new registrations of that type.
          Maintenance mode shows the public a maintenance page while admins keep full access, including this page.
        </p>
      </div>
      <SettingsEditor
        settingKey="features"
        title="Feature toggles"
        description="Switch platform modules on or off without a redeploy. Only super admins can change these."
      />
    </div>
  );
}
