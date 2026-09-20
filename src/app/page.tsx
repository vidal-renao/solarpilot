import Link from "next/link";

import { StudyForm } from "@/components/StudyForm";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <span className="font-display text-sm font-medium tracking-tight">
          Solar<span className="text-sun">Pilot</span>
        </span>
        <nav className="flex items-center gap-4">
          <Link
            href="/proceso"
            className="text-xs text-mist-dim transition-colors hover:text-snow"
          >
            El proceso
          </Link>
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

      <main className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        <section className="pt-10 sm:pt-16">
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
            Cuánto sol le cabe
            <br />
            <span className="text-sun">a tu tejado</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-mist">
            Dinos dónde vives y cuánta luz gastas. Te devolvemos cuántos paneles caben, cuánto
            producen y en cuánto tiempo se pagan.
          </p>

          <p className="mt-3 max-w-xl leading-relaxed text-mist-dim">
            Y también lo que no sabemos todavía, que en un preestudio importa igual.
          </p>

          <StudyForm />
        </section>

        <section className="mt-24 border-t border-line pt-10">
          <h2 className="font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
            Cómo se calcula
          </h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-sm text-snow">La radiación está medida</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-dim">
                La producción sale de PVGIS, el servicio de radiación solar de la Comisión Europea.
                No es una estimación nuestra: son series medidas para tus coordenadas.
              </p>
            </div>
            <div>
              <h3 className="text-sm text-snow">El consumo lo pones tú</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-dim">
                Con una factura basta para empezar. Con la curva horaria de tu suministro el
                reparto entre lo que aprovechas y lo que viertes deja de ser un perfil estadístico.
              </p>
            </div>
            <div>
              <h3 className="text-sm text-snow">El tejado hay que verlo</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-dim">
                Sombras, estado de la cubierta y cuadro eléctrico no se ven desde un mapa. Por eso
                esto es un preestudio y no un proyecto.
              </p>
            </div>
          </div>
        </section>

        {/*
          Cierra la pregunta que deja cualquier calculador sin responder. Un
          numero de ahorro sin lo que viene detras no sirve para decidir.
        */}
        <section className="mt-20 rounded-lg border border-line bg-ink-raised p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-medium tracking-tight">
                ¿Y después del preestudio?
              </h2>
              <p className="mt-3 leading-relaxed text-mist">
                Visita técnica, proyecto, licencia municipal, instalación, certificado, registro en
                tu comunidad, punto de conexión y contrato de compensación. Once pasos, y más de la
                mitad del plazo no lo controla ninguna instaladora.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-mist-dim">
                Están todos detallados: quién ejecuta cada uno, cuánto tarda, qué documentos exige y
                qué suele atascarlo.
              </p>
            </div>

            <Link
              href="/proceso"
              className="shrink-0 rounded border border-line px-5 py-2.5 font-display text-sm font-medium transition-colors hover:border-sun hover:text-sun"
            >
              Ver el proceso completo
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-5xl px-5 py-6 text-xs leading-relaxed text-mist-dim sm:px-8">
          SolarPilot es un proyecto de demostración. La empresa no existe, los precios son de
          catálogo ficticio y ningún dato introducido aquí se usa con fines comerciales. Los
          cálculos de radiación sí son reales, servidos por PVGIS (Comisión Europea).
        </p>
      </footer>
    </div>
  );
}
