import { ArrowRight, Clock } from 'lucide-react';
import Link from 'next/link';

export function ComingSoon({ title, body, release }: { title: string; body: string; release: string }) {
  return (
    <section className="glow-grid">
      <div className="mx-auto max-w-3xl px-4 py-28 text-center sm:px-6">
        <span className="pill"><Clock className="h-3.5 w-3.5 text-sun-400" /> {release}</span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-300">{body}</p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/calculator" className="btn btn-primary px-7 py-3">Size a system now <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/register" className="btn btn-secondary px-7 py-3">Create an account</Link>
        </div>
      </div>
    </section>
  );
}
