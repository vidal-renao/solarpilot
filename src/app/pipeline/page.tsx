import Link from "next/link";

import { LeadStateControl } from "@/components/LeadStateControl";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConfidenceDots } from "@/components/StudyResult";
import { tryQuery } from "@/lib/db/availability";
import { countByState, listLeads } from "@/lib/db/leads";
import { LEAD_STATES, leadStateLabel } from "@/lib/lead-states";

/** Lee de la base en cada visita: un pipeline cacheado enseña datos viejos. */
export const dynamic = "force-dynamic";

const eur = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 });

export default async function Pipeline() {
  const resultado = await tryQuery(async () => {
    const [leads, counts] = await Promise.all([listLeads(), countByState()]);
    return { leads, counts };
  });

  if (resultado.status !== "ok") {
    return <SinDatos motivo={resultado} />;
  }

  const { leads, counts } = resultado.data;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="font-display text-sm font-medium tracking-tight">
          Solar<span className="text-sun">Pilot</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="rounded-full border border-line px-3 py-1 text-[11px] text-mist-dim">
            Vista interna
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <h1 className="font-display text-3xl font-medium tracking-tight">Pipeline</h1>
        <p className="mt-2 text-mist">
          Leads capturados, con su preestudio y la confianza que merece cada uno.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-6">
          {LEAD_STATES.map((state) => (
            <div key={state} className="bg-ink-raised px-4 py-3">
              <p className="tabular text-2xl font-medium">{counts[state] ?? 0}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-mist-dim">
                {leadStateLabel(state)}
              </p>
            </div>
          ))}
        </div>

        {leads.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-line px-6 py-16 text-center">
            <p className="text-mist">Todavía no hay ningún lead.</p>
            <p className="mt-2 text-sm text-mist-dim">
              Calcula un preestudio y guárdalo, o ejecuta <code className="tabular">npm run db:seed</code>{" "}
              para poblar la base con ejemplos.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded bg-sun px-5 py-2.5 font-display font-medium text-ink transition-colors hover:bg-sun-hover"
            >
              Ir al calculador
            </Link>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Leads capturados</caption>
              <thead>
                <tr className="border-b border-line bg-ink-sunken text-left">
                  {["Lead", "Instalación", "Ahorro", "Retorno", "Confianza", "Estado"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-3 font-display text-[11px] font-medium uppercase tracking-[0.14em] text-mist-dim"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map(({ lead, study }) => (
                  <tr key={lead.id} className="border-b border-line last:border-0 align-top">
                    <td className="px-4 py-4">
                      <Link
                        href={`/propuesta/${lead.id}`}
                        className="font-medium transition-colors hover:text-sun"
                      >
                        {lead.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-mist-dim">{lead.email}</p>
                      <p className="mt-1 max-w-xs truncate text-xs text-mist-dim">
                        {lead.formattedAddress ?? lead.rawAddress}
                      </p>
                      {lead.stateReason && (
                        <p className="mt-1 text-xs text-sun">{lead.stateReason}</p>
                      )}
                    </td>
                    <td className="tabular px-4 py-4">
                      {study ? `${study.recommendedKWp.toLocaleString("es-ES")} kWp` : "—"}
                    </td>
                    <td className="tabular px-4 py-4">
                      {study ? `${eur(study.firstYearSavingsEUR)} €` : "—"}
                    </td>
                    <td className="tabular px-4 py-4">
                      {study?.paybackYears ? `${study.paybackYears.toLocaleString("es-ES")} años` : "—"}
                    </td>
                    <td className="px-4 py-4">
                      {study ? <ConfidenceDots level={study.confidence} label={false} /> : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <LeadStateControl leadId={lead.id} state={lead.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Estado explicito para cuando el pipeline no puede leer la base.
 *
 * Un despliegue sin `DATABASE_URL` es un escenario real y previsible: el
 * calculador funciona sin base, y solo la parte comercial la necesita.
 */
function SinDatos({
  motivo,
}: {
  motivo: { status: "sin_configurar" } | { status: "error"; message: string };
}) {
  const sinConfigurar = motivo.status === "sin_configurar";

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="font-display text-sm font-medium tracking-tight">
          Solar<span className="text-sun">Pilot</span>
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-16 sm:px-8">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {sinConfigurar ? "Falta la base de datos" : "La base de datos no responde"}
        </h1>

        <p className="mt-4 leading-relaxed text-mist">
          {sinConfigurar ? (
            <>
              Este despliegue no tiene <code className="tabular text-sun">DATABASE_URL</code>{" "}
              configurada, así que no hay dónde guardar ni de dónde leer los leads. El calculador
              funciona igualmente: no necesita base de datos hasta que guardas un preestudio.
            </>
          ) : (
            <>
              La configuración existe, pero la conexión ha fallado. No es un problema de datos que
              falten: es que no se ha podido llegar a ellos.
            </>
          )}
        </p>

        {!sinConfigurar && (
          <p className="mt-4 border-l-2 border-line pl-4 font-mono text-xs leading-relaxed text-mist-dim">
            {motivo.message}
          </p>
        )}

        <Link
          href="/"
          className="mt-8 inline-block rounded bg-sun px-5 py-2.5 font-display font-medium text-ink transition-colors hover:bg-sun-hover"
        >
          Ir al calculador
        </Link>
      </main>
    </div>
  );
}
