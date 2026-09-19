import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 sm:px-8">
      <p className="font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
        404
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-tight">
        Aquí no hay nada
      </h1>
      <p className="mt-3 leading-relaxed text-mist">
        Puede que la propuesta se haya retirado o que el enlace esté mal copiado. Los expedientes
        no caducan solos, así que prueba a revisar el enlace antes de pedir uno nuevo.
      </p>
      <Link
        href="/"
        className="mt-7 w-fit rounded bg-sun px-5 py-2.5 font-display font-medium text-ink transition-opacity hover:opacity-90"
      >
        Ir al calculador
      </Link>
    </main>
  );
}
