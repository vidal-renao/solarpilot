"use client";

import { useState } from "react";

import type { CashflowYear } from "@/lib/solar/types";

const eur = (n: number) => Math.round(n).toLocaleString("es-ES");

const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 26, left: 52 };

/**
 * Amortizacion: ahorro acumulado frente a la inversion.
 *
 * La pregunta que responde es una sola —cuando se cruza la inversion— asi
 * que el umbral es una linea de referencia y no una segunda serie. Serie
 * unica: no lleva leyenda, la nombra el titulo.
 *
 * Los valores se muestran al pasar por encima, nunca todos a la vez, y el
 * unico punto etiquetado en reposo es el de recuperacion, que es el dato que
 * la gente viene a buscar.
 */
export function AmortizationChart({
  schedule,
  investmentEUR,
  paybackYears,
}: {
  schedule: CashflowYear[];
  investmentEUR: number;
  paybackYears: number | null;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (schedule.length === 0) return null;

  const maxY = Math.max(investmentEUR, schedule[schedule.length - 1]?.cumulativeEUR ?? 0) * 1.08;
  const maxX = schedule.length;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (year: number) => PAD.left + ((year - 1) / (maxX - 1)) * plotW;
  const y = (value: number) => PAD.top + plotH - (value / maxY) * plotH;

  const linea = schedule.map((f) => `${x(f.year)},${y(f.cumulativeEUR)}`).join(" ");
  const area = `${PAD.left},${y(0)} ${linea} ${x(maxX)},${y(0)}`;
  const yInversion = y(investmentEUR);

  const corte = schedule.find((f) => f.breakEven);
  const activo = hovered !== null ? schedule[hovered] : undefined;

  return (
    <figure>
      <figcaption className="mb-4 flex items-baseline justify-between gap-4">
        <span className="font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
          Ahorro acumulado frente a la inversion
        </span>
        <span className="tabular text-xs text-mist-dim">
          {activo ? `Año ${activo.year} · ${eur(activo.cumulativeEUR)} €` : "EUR"}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Ahorro acumulado durante ${maxX} años frente a una inversion de ${eur(investmentEUR)} euros.${paybackYears ? ` Se recupera en ${paybackYears} años.` : ""}`}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Rejilla discreta: orienta sin competir con el dato. */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + plotH * (1 - t)}
            y2={PAD.top + plotH * (1 - t)}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
        ))}

        <polygon points={area} fill="var(--color-sun)" opacity="0.12" />
        <polyline
          points={linea}
          fill="none"
          stroke="var(--color-sun)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Umbral: no es una serie, es una referencia. Discreto y punteado. */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={yInversion}
          y2={yInversion}
          stroke="var(--color-line-bright)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <text
          x={PAD.left}
          y={yInversion - 6}
          className="tabular"
          fontSize="10"
          fill="var(--color-mist-dim)"
        >
          inversion {eur(investmentEUR)} €
        </text>

        {/* El unico punto etiquetado en reposo. */}
        {corte && (
          <>
            <line
              x1={x(corte.year)}
              x2={x(corte.year)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--color-sun)"
              strokeWidth="1"
              opacity="0.4"
            />
            <circle
              cx={x(corte.year)}
              cy={y(corte.cumulativeEUR)}
              r="5"
              fill="var(--color-sun)"
              stroke="var(--color-ink-raised)"
              strokeWidth="2"
            />
          </>
        )}

        {/* Cruz y marcador al pasar por encima. */}
        {activo && (
          <>
            <line
              x1={x(activo.year)}
              x2={x(activo.year)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--color-mist-dim)"
              strokeWidth="1"
            />
            <circle
              cx={x(activo.year)}
              cy={y(activo.cumulativeEUR)}
              r="4"
              fill="var(--color-snow)"
              stroke="var(--color-ink-raised)"
              strokeWidth="2"
            />
          </>
        )}

        {/* Zonas de captura, mas anchas que la marca. */}
        {schedule.map((f, i) => (
          <rect
            key={f.year}
            x={x(f.year) - plotW / maxX / 2}
            y={PAD.top}
            width={plotW / maxX}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}

        <text x={PAD.left} y={H - 8} fontSize="10" fill="var(--color-mist-dim)" className="tabular">
          año 1
        </text>
        <text
          x={W - PAD.right}
          y={H - 8}
          fontSize="10"
          textAnchor="end"
          fill="var(--color-mist-dim)"
          className="tabular"
        >
          año {maxX}
        </text>
      </svg>

      {/* Vista de tabla: el mismo dato sin depender de la vista ni del color. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-mist-dim transition-colors hover:text-mist">
          Ver el cuadro año a año
        </summary>
        <div className="mt-3 max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ink-raised">
              <tr className="text-left text-mist-dim">
                <th scope="col" className="py-1.5 font-medium">Año</th>
                <th scope="col" className="py-1.5 text-right font-medium">Produccion</th>
                <th scope="col" className="py-1.5 text-right font-medium">Ahorro</th>
                <th scope="col" className="py-1.5 text-right font-medium">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((f) => (
                <tr
                  key={f.year}
                  className="border-t border-line"
                  style={f.breakEven ? { color: "var(--color-sun)" } : undefined}
                >
                  <td className="tabular py-1.5">{f.year}</td>
                  <td className="tabular py-1.5 text-right">{eur(f.productionKWh)} kWh</td>
                  <td className="tabular py-1.5 text-right">{eur(f.savingsEUR)} €</td>
                  <td className="tabular py-1.5 text-right">{eur(f.cumulativeEUR)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
