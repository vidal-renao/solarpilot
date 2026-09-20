import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/PrintButton";
import { SolarYear } from "@/components/SolarYear";
import { tryQuery } from "@/lib/db/availability";
import { getLead } from "@/lib/db/leads";
import type { PreliminaryStudy } from "@/lib/solar/types";

/** Validez de la oferta. Una propuesta sin caducidad es un compromiso abierto. */
const VALIDITY_DAYS = 30;

/**
 * Titulo propio, deliberadamente sin el nombre del cliente.
 *
 * El titulo de una pagina acaba en la pestana, en el historial del navegador
 * y en cualquier captura que alguien haga. Un dato personal no tiene por que
 * estar ahi para que la pagina se identifique bien.
 */
export const metadata: Metadata = {
  title: "Propuesta de instalación fotovoltaica — SolarPilot",
  description:
    "Propuesta preliminar de autoconsumo: potencia, producción estimada, condiciones económicas y lo que queda por comprobar.",
  robots: { index: false, follow: false },
};

const eur = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
const kwh = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
const fecha = (d: Date) =>
  d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

function Cifra({ valor, unidad, etiqueta }: { valor: string; unidad: string; etiqueta: string }) {
  return (
    <div>
      <p className="flex items-baseline gap-1">
        <span className="tabular text-2xl font-medium">{valor}</span>
        <span className="text-sm text-mist-dim">{unidad}</span>
      </p>
      <p className="mt-0.5 text-xs text-mist-dim">{etiqueta}</p>
    </div>
  );
}

export default async function Propuesta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await tryQuery(() => getLead(id));

  // Sin base de datos no se puede afirmar que la propuesta no exista, solo
  // que no se puede comprobar. Un 404 seria mentir sobre lo que sabemos.
  if (resultado.status !== "ok") notFound();
  if (!resultado.data?.study) notFound();

  const { lead, study: row } = resultado.data;
  const study = row.payload as PreliminaryStudy;
  const s = study.sizing.value;
  const e = study.energy.value;
  const ec = study.economics.value;

  const emitida = row.createdAt;
  const caduca = new Date(emitida.getTime() + VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  const caducada = caduca.getTime() < Date.now();

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <div className="no-print mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-mist transition-colors hover:text-snow">
            ← Volver al calculador
          </Link>
          <PrintButton />
        </div>

        <header className="border-b border-line pb-6">
          <p className="font-display text-sm font-medium tracking-tight">
            Solar<span className="text-sun">Pilot</span>
          </p>
          <h1 className="mt-4 font-display text-3xl font-medium leading-tight">
            Propuesta de instalación fotovoltaica
          </h1>
          <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-mist-dim">Para</dt>
              <dd>{lead.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-mist-dim">Emitida</dt>
              <dd className="tabular">{fecha(emitida)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-mist-dim">Emplazamiento</dt>
              <dd>{lead.formattedAddress ?? lead.rawAddress}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-mist-dim">Válida hasta</dt>
              <dd className="tabular">
                {fecha(caduca)}
                {caducada && <span className="ml-2 text-sun">caducada</span>}
              </dd>
            </div>
          </dl>
        </header>

        {caducada && (
          <p className="mt-6 border-l-2 border-sun pl-4 text-sm leading-relaxed">
            Esta propuesta ha superado su periodo de validez. Los precios de módulos e inversores se
            mueven, así que las cifras económicas hay que recalcularlas antes de usarlas.
          </p>
        )}

        <section className="border-b border-line py-7">
          <h2 className="mb-5 font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
            Instalación propuesta
          </h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Cifra valor={s.recommendedKWp.toLocaleString("es-ES")} unidad="kWp" etiqueta="Potencia pico" />
            <Cifra valor={String(s.panelCount)} unidad="módulos" etiqueta={`de ${s.panelWattsPeak} Wp`} />
            <Cifra valor={s.estimatedAreaM2.toLocaleString("es-ES")} unidad="m²" etiqueta="Superficie ocupada" />
            <Cifra valor={kwh(e.annualProductionKWh)} unidad="kWh" etiqueta="Producción anual" />
          </div>
        </section>

        <section className="border-b border-line py-7">
          <h2 className="mb-5 font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
            Producción estimada
          </h2>
          <SolarYear monthlyKWh={e.monthlyProductionKWh} />
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            {[
              ["Autoconsumo", `${Math.round(e.selfConsumptionRatio * 100)} %`],
              ["Cobertura del consumo", `${Math.round(e.selfSufficiencyRatio * 100)} %`],
              ["Excedente vertido", `${kwh(e.exportedKWh)} kWh`],
              ["CO₂ evitado", `${ec.avoidedCO2TonnesPerYear.toLocaleString("es-ES")} t/año`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-line pb-1.5">
                <dt className="text-mist-dim">{k}</dt>
                <dd className="tabular">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-b border-line py-7">
          <h2 className="mb-5 font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
            Condiciones económicas
          </h2>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Cifra valor={eur(ec.investmentEUR)} unidad="€" etiqueta="Inversión estimada" />
            <Cifra valor={eur(ec.firstYearSavingsEUR)} unidad="€/año" etiqueta="Ahorro el primer año" />
            <Cifra
              valor={ec.simplePaybackYears?.toLocaleString("es-ES") ?? "—"}
              unidad="años"
              etiqueta="Retorno de la inversión"
            />
            <Cifra valor={eur(ec.lifetimeSavingsEUR)} unidad="€" etiqueta="Ahorro acumulado a 25 años" />
          </div>
          <p className="mt-5 text-xs leading-relaxed text-mist-dim">
            Importes sin IVA y sin incluir ayudas ni bonificaciones fiscales, que dependen del
            municipio y de la convocatoria vigente. El retorno se calcula con degradación de los
            módulos y sin suponer subidas del precio de la electricidad.
          </p>
        </section>

        <section className="border-b border-line py-7">
          <h2 className="mb-5 font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
            Sobre qué se sostienen estas cifras
          </h2>
          <ul className="space-y-3">
            {study.assumptions.map((a) => (
              <li key={a.id} className="border-l border-line pl-4 text-sm">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span>{a.description}</span>
                  <span className="tabular text-xs text-sun">{a.value}</span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-mist-dim">{a.impact}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-b border-line py-7">
          <h2 className="mb-5 font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
            Qué falta por comprobar
          </h2>
          <ul className="space-y-2">
            {study.missingData.map((item) => (
              <li key={item} className="border-l border-line pl-4 text-sm leading-relaxed text-mist">
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Una propuesta que no dice cual es el paso siguiente deja al cliente
            con un numero y sin nada que hacer con el. */}
        <section className="border-b border-line py-7">
          <h2 className="mb-5 font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
            El siguiente paso
          </h2>
          <p className="max-w-prose leading-relaxed">
            Una <strong className="font-medium">visita técnica</strong>. Es donde se mide la
            cubierta, se evalúan sombras, estructura y cuadro eléctrico, y donde estas cifras se
            convierten en un presupuesto cerrado.
          </p>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-mist">
            A partir de ahí quedan el proyecto o memoria técnica, el trámite municipal, la
            instalación, el certificado eléctrico, el registro en la comunidad autónoma y —si hay
            vertido de excedentes— el punto de conexión y el contrato de compensación.
          </p>
          <p className="no-print mt-4 text-sm">
            <Link
              href="/proceso"
              className="underline decoration-line underline-offset-4 transition-colors hover:text-sun"
            >
              Ver el recorrido completo con plazos
            </Link>
          </p>
        </section>

        <footer className="py-7">
          <p className="text-xs leading-relaxed text-mist-dim">{study.disclaimer}</p>
          <p className="mt-4 text-xs leading-relaxed text-mist-dim">
            SolarPilot es un proyecto de demostración. La empresa no existe y los precios proceden de
            un catálogo ficticio. Los datos de radiación sí son reales, servidos por PVGIS (Comisión
            Europea). Referencia del expediente: <span className="tabular">{lead.id.slice(0, 8)}</span>.
          </p>
        </footer>
      </div>
    </div>
  );
}
