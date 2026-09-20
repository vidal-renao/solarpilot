"use client";

import { useState } from "react";

import {
  formatDuration,
  OWNER_LABELS,
  stepsFor,
  totalDuration,
  type ProcessStep,
  type StepOwner,
} from "@/lib/solar/process";

/** Terceros: ni la instaladora ni el cliente marcan estos tiempos. */
const TERCEROS: ReadonlySet<StepOwner> = new Set<StepOwner>([
  "administracion",
  "distribuidora",
  "comercializadora",
]);

/**
 * Semanas del total, siempre hacia arriba.
 *
 * Un plazo estimado solo se nota cuando se queda corto, asi que el redondeo
 * va en la direccion que no promete de mas.
 */
const semanas = (dias: number) => Math.ceil(dias / 7);

function Paso({ step, index }: { step: ProcessStep; index: number }) {
  const ajeno = TERCEROS.has(step.owner);

  return (
    <li className="relative border-l border-line pb-10 pl-8 last:pb-0">
      {/* El marcador distingue de un vistazo lo propio de lo ajeno. */}
      <span
        aria-hidden
        className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: ajeno ? "var(--color-line-bright)" : "var(--color-sun)" }}
      />

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tabular text-xs text-mist-dim">{String(index + 1).padStart(2, "0")}</span>
        <h3 className="font-display text-lg font-medium">{step.name}</h3>
        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-mist-dim">
          {OWNER_LABELS[step.owner]}
        </span>
        <span className="tabular ml-auto text-xs text-mist">{formatDuration(step.duration)}</span>
      </div>

      {step.appliesWhen && (
        <p className="mt-1.5 text-xs text-sun">{step.appliesWhen}</p>
      )}

      <p className="mt-2 max-w-prose leading-relaxed text-mist">{step.summary}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-[11px] uppercase tracking-wider text-mist-dim">Documentos</h4>
          <ul className="space-y-1">
            {step.documents.map((d) => (
              <li key={d} className="text-xs leading-relaxed text-mist">
                {d}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-[11px] uppercase tracking-wider text-mist-dim">
            Qué puede atascarlo
          </h4>
          <ul className="space-y-1.5">
            {step.risks.map((r) => (
              <li key={r} className="border-l border-line pl-3 text-xs leading-relaxed text-mist-dim">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {step.source && (
        <p className="mt-3 text-[11px] text-mist-dim">
          Plazo según{" "}
          <a
            href={step.source.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-line underline-offset-2 transition-colors hover:text-sun"
          >
            {step.source.label}
          </a>{" "}
          (consultada el {step.source.consultedAt}).
        </p>
      )}
    </li>
  );
}

export function ProcessTimeline() {
  const [conExcedentes, setConExcedentes] = useState(true);
  const pasos = stepsFor(conExcedentes);
  const total = totalDuration(conExcedentes);

  const porcentajeAjeno = Math.round((total.outOfControlMaxDays / total.maxDays) * 100);

  return (
    <>
      <div className="mt-10 rounded-lg border border-line bg-ink-raised p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="flex items-baseline gap-2">
              <span className="tabular text-3xl font-medium text-sun sm:text-4xl">
                {semanas(total.minDays)}–{semanas(total.maxDays)}
              </span>
              <span className="text-sm text-mist-dim">semanas en total</span>
            </p>
            <p className="mt-1 text-xs text-mist-dim">
              Desde el preestudio hasta que la instalación produce
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-mist">
            <input
              type="checkbox"
              className="accent-sun"
              checked={conExcedentes}
              onChange={(e) => setConExcedentes(e.target.checked)}
            />
            Con vertido de excedentes
          </label>
        </div>

        {/* La barra es el argumento de la pagina: cuanto de la espera es ajeno. */}
        <div className="mt-6">
          <div
            className="flex h-2 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`De un plazo máximo de ${semanas(total.maxDays)} semanas, alrededor del ${porcentajeAjeno} por ciento depende de administración, distribuidora y comercializadora.`}
          >
            <span
              className="rounded-l-full"
              style={{
                width: `${100 - porcentajeAjeno}%`,
                backgroundColor: "var(--color-sun)",
              }}
            />
            <span
              className="rounded-r-full"
              style={{
                width: `${porcentajeAjeno}%`,
                backgroundColor: "var(--color-line-bright)",
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 rounded-full bg-sun" />
              <span className="text-mist">Lo que depende de la instaladora y de ti</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--color-line-bright)" }}
              />
              <span className="text-mist">
                Administración, distribuidora y comercializadora ·{" "}
                <span className="tabular">{porcentajeAjeno} %</span>
              </span>
            </span>
          </div>
        </div>

        <p className="mt-5 max-w-prose text-xs leading-relaxed text-mist-dim">
          Quien te prometa una fecha cerrada está prometiendo algo que no controla. El paso más
          lento suele ser la solicitud del punto de conexión a la distribuidora, que puede irse a
          dos meses. Lo que sí se puede prometer es llevar la documentación completa desde el
          principio, que es la causa más común de retraso en todo lo demás.
        </p>
      </div>

      <ol className="mt-12">
        {pasos.map((step, i) => (
          <Paso key={step.id} step={step} index={i} />
        ))}
      </ol>
    </>
  );
}
