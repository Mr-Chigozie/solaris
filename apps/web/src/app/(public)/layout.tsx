import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { AnnouncementBar } from '@/features/site/announcement-bar';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
