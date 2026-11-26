import { Suspense } from 'react';
import { Inbox } from '@/features/messaging/inbox';

export default function MessagesPage() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}
