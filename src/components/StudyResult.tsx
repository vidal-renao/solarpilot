import type { ScenarioComparison } from "@/app/actions";
import type { IncentiveEstimate } from "@/lib/solar/incentives";
import type { RoofInsight } from "@/lib/solar/roof";
import type { Confidence, PreliminaryStudy } from "@/lib/solar/types";

import { AmortizationChart } from "./AmortizationChart";
import { BatteryComparison } from "./BatteryComparison";
import { SolarYear } from "./SolarYear";

const NIVEL: Record<Confidence, { puntos: number; texto: string }> = {
  alta: { puntos: 3, texto: "Confianza alta" },
  media: { puntos: 2, texto: "Confianza media" },
  baja: { puntos: 1, texto: "Confianza baja" },
};

/**
 * La confianza en tres puntos, no en semaforo.
 *
 * Un rojo diria "roto", y una confianza baja no es una averia: es el estado
 * normal de un preestudio hecho sin la curva de consumo real.
 */
export function ConfidenceDots({ level, label = true }: { level: Confidence; label?: boolean }) {
  const { puntos, texto } = NIVEL[level];
  return (
    <span className="inline-flex items-center gap-2" title={texto}>
      <span aria-hidden className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: i < puntos ? "var(--color-sun)" : "var(--color-line-bright)",
            }}
          />
        ))}
      </span>
      {label && <span className="text-xs text-mist">{texto}</span>}
      {!label && <span className="sr-only">{texto}</span>}
    </span>
  );
}

function Dato({
  valor,
  unidad,
  etiqueta,
  destacado = false,
}: {
  valor: string;
  unidad: string;
  etiqueta: string;
  destacado?: boolean;
}) {
  return (
    <div>
      <p className="flex items-baseline gap-1">
        <span
          className={`tabular font-medium ${destacado ? "text-3xl sm:text-4xl" : "text-2xl"}`}
          style={{ color: destacado ? "var(--color-sun)" : "var(--color-snow)" }}
        >
          {valor}
        </span>
        <span className="text-sm text-mist-dim">{unidad}</span>
      </p>
      <p className="mt-1 text-xs text-mist-dim">{etiqueta}</p>
    </div>
  );
}

function Panel({
  titulo,
  children,
  aside,
}: {
  titulo: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="border-t border-line px-5 py-6 sm:px-8">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
          {titulo}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const eur = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
const kwh = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 });

const AMBITO: Record<string, string> = {
  estatal: "Estatal",
  autonomico: "Autonomico",
  municipal: "Municipal",
};

/**
 * Una ayuda, con lo que hace falta para acceder a ella.
 *
 * El importe se muestra plegado y las condiciones desplegadas a un clic. Un
 * incentivo sin sus requisitos al lado es una cifra que el cliente dara por
 * suya, y la mayoria de ellos exigen tramites que nadie le ha contado.
 */
function Incentivo({
  estimate,
  aplicada = false,
}: {
  estimate: IncentiveEstimate;
  aplicada?: boolean;
}) {
  const { program } = estimate;
  return (
    <details className="border-b border-line py-3 last:border-0">
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-2">
          <span className="text-sm text-snow">{program.name}</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-mist-dim">
            {AMBITO[program.scope]}
          </span>
        </span>
        <span
          className="tabular text-sm"
          style={{ color: aplicada ? "var(--color-sun)" : "var(--color-mist)" }}
        >
          {aplicada ? "−" : "hasta "}
          {eur(estimate.amountEUR)} €
        </span>
      </summary>

      <div className="mt-3 space-y-3 pl-1">
        <p className="text-xs leading-relaxed text-mist">{program.description}</p>
        <p className="text-xs text-mist-dim">
          Calculo: <span className="tabular">{estimate.basis}</span>
        </p>
        <ul className="space-y-1">
          {program.requirements.map((r) => (
            <li key={r} className="border-l border-line pl-3 text-xs leading-relaxed text-mist-dim">
              {r}
            </li>
          ))}
        </ul>
        <p className="text-xs text-mist-dim">
          {program.deadline ? `Plazo: ${program.deadline}. ` : ""}
          Fuente:{" "}
          <a
            href={program.source.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-line underline-offset-2 transition-colors hover:text-sun"
          >
            {program.source.label}
          </a>{" "}
          (consultada el {program.source.consultedAt}).
        </p>
      </div>
    </details>
  );
}

export function StudyResult({
  study,
  roof,
  addressPrecise,
  comparison,
}: {
  study: PreliminaryStudy;
  roof: RoofInsight;
  addressPrecise: boolean;
  comparison: ScenarioComparison;
}) {
  const s = study.sizing.value;
  const e = study.energy.value;
  const ec = study.economics.value;

  return (
    <article className="fade-up overflow-hidden rounded-lg border border-line bg-ink-raised">
      {/* La confianza va primero, antes que ningun numero. */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-ink-sunken px-5 py-4 sm:px-8">
        <ConfidenceDots level={study.overallConfidence} />
        <p className="text-xs text-mist-dim">
          {study.input.location.formattedAddress?.split(",").slice(0, 3).join(", ")}
        </p>
      </header>

      {!addressPrecise && (
        <p className="border-b border-line bg-ink-sunken px-5 pb-4 text-xs text-mist sm:px-8">
          La direccion se ha localizado a nivel de zona, no de portal. La radiacion apenas cambia,
          pero el tejado si: afina la direccion para un resultado mas ajustado.
        </p>
      )}

      <Panel
        titulo="La instalacion que sale"
        aside={
          <span className="text-xs text-mist-dim">
            limita el {s.limitingFactor.replace("_", " ")}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Dato valor={s.recommendedKWp.toLocaleString("es-ES")} unidad="kWp" etiqueta="Potencia" />
          <Dato valor={String(s.panelCount)} unidad="paneles" etiqueta={`de ${s.panelWattsPeak} Wp`} />
          <Dato valor={s.estimatedAreaM2.toLocaleString("es-ES")} unidad="m²" etiqueta="Superficie" />
          <Dato valor={kwh(e.annualProductionKWh)} unidad="kWh" etiqueta="Produccion al año" destacado />
        </div>
      </Panel>

      <Panel titulo="El año solar" aside={<ConfidenceDots level={study.energy.confidence} label={false} />}>
        <SolarYear monthlyKWh={e.monthlyProductionKWh} />
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div className="flex justify-between gap-2 border-b border-line pb-2">
            <dt className="text-mist-dim">Autoconsumo</dt>
            <dd className="tabular">{Math.round(e.selfConsumptionRatio * 100)} %</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-line pb-2">
            <dt className="text-mist-dim">Cobertura</dt>
            <dd className="tabular">{Math.round(e.selfSufficiencyRatio * 100)} %</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-line pb-2">
            <dt className="text-mist-dim">Excedente</dt>
            <dd className="tabular">{kwh(e.exportedKWh)} kWh</dd>
          </div>
        </dl>
      </Panel>

      <Panel titulo="De donde sale el ahorro">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <Dato
            valor={eur(ec.selfConsumptionSavingsEUR)}
            unidad="€/año"
            etiqueta="Energia que dejas de comprar"
            destacado
          />
          <Dato
            valor={eur(ec.compensationEUR)}
            unidad="€/año"
            etiqueta="Compensacion de excedentes"
          />
          <Dato valor={eur(ec.firstYearSavingsEUR)} unidad="€/año" etiqueta="Total el primer año" />
        </div>

        {ec.compensationCapped ? (
          <div className="mt-5 border-l-2 border-sun pl-4">
            <p className="text-sm leading-relaxed text-snow">
              Esta instalacion vierte mas energia de la que puede compensar.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-mist-dim">
              La compensacion simplificada solo descuenta hasta dejar a cero el termino de energia
              de tu factura: nunca se cobra dinero por el excedente. Con este dimensionado sobran{" "}
              <span className="tabular text-sun">{kwh(ec.uncompensatedExportKWh)} kWh</span> al año
              que se regalan a la red. Bajar potencia, o anadir bateria, aprovecharia mas.
            </p>
          </div>
        ) : (
          <p className="mt-5 text-xs leading-relaxed text-mist-dim">
            La compensacion de excedentes solo descuenta hasta dejar a cero el termino de energia de
            la factura; nunca genera un cobro. Con este dimensionado no se alcanza ese tope, asi que
            se aprovecha todo lo vertido.
          </p>
        )}
      </Panel>

      <Panel
        titulo="Cuanto tarda en pagarse"
        aside={
          <span className="tabular text-xs text-mist-dim">
            {ec.netInvestmentEUR < ec.investmentEUR
              ? `${eur(ec.investmentEUR)} € − ${eur(ec.investmentEUR - ec.netInvestmentEUR)} € de ayudas`
              : `${eur(ec.investmentEUR)} € de inversion`}
          </span>
        }
      >
        <AmortizationChart
          schedule={ec.schedule}
          investmentEUR={ec.netInvestmentEUR}
          paybackYears={ec.simplePaybackYears}
        />

        <div className="mt-6">
          <h4 className="mb-3 text-xs uppercase tracking-wider text-mist-dim">
            Y si la luz sube de precio
          </h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mist-dim">
                <th scope="col" className="pb-2 font-medium">Escenario</th>
                <th scope="col" className="pb-2 text-right font-medium">Retorno</th>
                <th scope="col" className="pb-2 text-right font-medium">Ahorro a 25 años</th>
              </tr>
            </thead>
            <tbody>
              {ec.sensitivity.map((s) => (
                <tr key={s.label} className="border-t border-line">
                  <td className="py-2 text-mist">{s.label}</td>
                  <td className="tabular py-2 text-right">
                    {s.paybackYears
                      ? `${s.paybackYears.toLocaleString("es-ES")} años`
                      : "no amortiza"}
                  </td>
                  <td className="tabular py-2 text-right">{eur(s.lifetimeSavingsEUR)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-relaxed text-mist-dim">
            El calculo principal usa el escenario de precio congelado. Es el mas conservador y el
            unico que no exige adivinar el futuro: cualquier subida real acorta el plazo.
          </p>
        </div>
      </Panel>

      <Panel
        titulo="¿Compensa la bateria?"
        aside={
          <span className="text-xs text-mist-dim">
            los dos escenarios, calculados a la vez
          </span>
        }
      >
        <BatteryComparison
          sinBateria={comparison.sinBateria}
          conBateria={comparison.conBateria}
          verdict={comparison.verdict}
          actual={study.input.withBattery ?? false}
        />
      </Panel>

      <Panel
        titulo="Ayudas e incentivos"
        aside={
          <span className="tabular text-xs text-mist-dim">
            {study.incentives.applied.length} aplicadas ·{" "}
            {study.incentives.potential.length} por verificar
          </span>
        }
      >
        {study.incentives.applied.length > 0 && (
          <div className="mb-6">
            <h4 className="mb-2 text-xs uppercase tracking-wider text-mist-dim">
              Descontadas del calculo
            </h4>
            {study.incentives.applied.map((i) => (
              <Incentivo key={i.program.id} estimate={i} aplicada />
            ))}
          </div>
        )}

        <div>
          <h4 className="mb-2 text-xs uppercase tracking-wider text-mist-dim">
            Posibles, no incluidas en el retorno
          </h4>
          {study.incentives.potential.map((i) => (
            <Incentivo key={i.program.id} estimate={i} />
          ))}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-mist-dim">
          Solo se descuenta del retorno lo que consta que se cumple. Las bonificaciones municipales
          dependen de la ordenanza de cada ayuntamiento, asi que figuran como margen de mejora
          —hasta{" "}
          <span className="tabular text-sun">{eur(study.incentives.potentialTotalEUR)} €</span>— y
          no como dinero seguro. Ninguna ayuda esta concedida hasta que la concede quien puede.
        </p>
      </Panel>

      <Panel titulo="De donde sale cada numero">
        <ul className="space-y-3 text-sm">
          {[
            { etiqueta: "Dimensionado", t: study.sizing },
            { etiqueta: "Energia", t: study.energy },
            { etiqueta: "Economia", t: study.economics },
          ].map(({ etiqueta, t }) => (
            <li key={etiqueta} className="flex flex-col gap-1 border-b border-line pb-3 sm:flex-row sm:gap-4">
              <span className="w-28 shrink-0 text-mist-dim">{etiqueta}</span>
              <span className="flex-1 text-mist">{t.provenance.detail}</span>
              <ConfidenceDots level={t.confidence} label={false} />
            </li>
          ))}
          <li className="flex flex-col gap-1 pb-1 sm:flex-row sm:gap-4">
            <span className="w-28 shrink-0 text-mist-dim">Cubierta</span>
            <span className="flex-1 text-mist">{roof.provenance.detail}</span>
            <ConfidenceDots level={roof.confidence} label={false} />
          </li>
        </ul>
      </Panel>

      <details className="group border-t border-line">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm text-mist transition-colors hover:text-snow sm:px-8">
          <span className="font-display text-xs font-medium uppercase tracking-[0.18em]">
            Supuestos y lo que no sabemos
          </span>
          <span className="ml-2 text-mist-dim group-open:hidden">
            ({study.assumptions.length + study.missingData.length})
          </span>
        </summary>

        <div className="space-y-6 px-5 pb-6 sm:px-8">
          <div>
            <h4 className="mb-3 text-xs uppercase tracking-wider text-mist-dim">Supuestos adoptados</h4>
            <ul className="space-y-3">
              {study.assumptions.map((a) => (
                <li key={a.id} className="border-l border-line pl-4 text-sm">
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="text-snow">{a.description}</span>
                    <span className="tabular text-xs text-sun">{a.value}</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-mist-dim">{a.impact}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs uppercase tracking-wider text-mist-dim">
              Datos que faltan y elevarian la confianza
            </h4>
            <ul className="space-y-2">
              {[...study.missingData, ...roof.caveats].map((item) => (
                <li key={item} className="border-l border-line pl-4 text-sm leading-relaxed text-mist">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      <footer className="border-t border-line bg-ink-sunken px-5 py-5 sm:px-8">
        <p className="text-xs leading-relaxed text-mist-dim">{study.disclaimer}</p>
      </footer>
    </article>
  );
}
