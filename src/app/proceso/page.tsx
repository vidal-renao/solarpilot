import type { Metadata } from "next";
import Link from "next/link";

import { ProcessTimeline } from "@/components/ProcessTimeline";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Del preestudio al primer kWh — SolarPilot",
  description:
    "Qué pasa después de un preestudio solar: los once pasos hasta la puesta en marcha, quién ejecuta cada uno, cuánto tarda y qué puede atascarlo.",
};

export default function Proceso() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="font-display text-sm font-medium tracking-tight">
          Solar<span className="text-sun">Pilot</span>
        </Link>
        <nav className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href="/pipeline"
            className="text-xs text-mist-dim transition-colors hover:text-snow"
          >
            Pipeline
          </Link>
          <span className="rounded-full border border-line px-3 py-1 text-[11px] text-mist-dim">
            Proyecto de demostracion
          </span>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-24 sm:px-8">
        <section className="pt-8 sm:pt-12">
          <p className="font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
            Qué pasa después del preestudio
          </p>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
            Del preestudio
            <br />
            <span className="text-sun">al primer kWh</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mist">
            Un número de ahorro no sirve de nada si nadie te cuenta qué viene detrás. Estos son los
            pasos reales, quién ejecuta cada uno y qué suele atascarse.
          </p>

          <p className="mt-3 max-w-2xl leading-relaxed text-mist-dim">
            Incluido el plazo que ninguna instaladora controla, que es más de la mitad.
          </p>
        </section>

        <ProcessTimeline />

        <section className="mt-16 border-t border-line pt-10">
          <h2 className="font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
            Sobre estos plazos
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-mist">
            Varían por comunidad autónoma, por potencia instalada y, sobre todo, por lo completa que
            vaya la documentación desde el primer día. Las fuentes de cada plazo están citadas en el
            paso correspondiente, con la fecha en que se consultaron.
          </p>
          <p className="mt-4 max-w-2xl leading-relaxed text-mist-dim">
            SolarPilot es un proyecto de demostración: esto es información pública contrastada, no
            asesoramiento. Lo que diga la administración competente de tu comunidad manda sobre
            cualquier cosa escrita aquí.
          </p>

          <Link
            href="/"
            className="mt-8 inline-block rounded bg-sun px-5 py-2.5 font-display font-medium text-ink transition-opacity hover:opacity-90"
          >
            Calcular mi preestudio
          </Link>
        </section>
      </main>
    </div>
  );
}
