import { Brand } from '@/components/brand';
import { PowerFlow } from '@/components/power-flow';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Brand />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </div>
      <aside className="glow-grid relative hidden border-l border-white/[0.06] lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="card mx-auto w-full max-w-md p-7">
          <PowerFlow solarLabel="2.2 kWp" homeLabel="0.9 kW" batteryLabel="5.1 kWh" gridLabel="Outage" batteryLevel={0.64} />
        </div>
        <p className="mx-auto mt-10 max-w-md text-center text-lg font-semibold leading-relaxed text-ink-100">
          Save your designs, request professional reviews and track your installation — all in one place.
        </p>
      </aside>
    </div>
  );
}
