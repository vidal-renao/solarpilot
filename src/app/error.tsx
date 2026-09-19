"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 sm:px-8">
      <p className="font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
        Error
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-tight">
        Se ha roto algo por dentro
      </h1>
      <p className="mt-3 leading-relaxed text-mist">
        No es culpa tuya y no se ha guardado nada a medias. Si vuelve a pasar con la misma
        dirección, probablemente sea uno de los servicios externos de los que depende el cálculo.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-7 w-fit rounded bg-sun px-5 py-2.5 font-display font-medium text-ink transition-opacity hover:opacity-90"
      >
        Volver a intentarlo
      </button>
    </main>
  );
}
