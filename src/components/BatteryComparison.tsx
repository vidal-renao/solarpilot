import type { ScenarioSummary, ScenarioVerdict } from "@/lib/solar/compare";

const eur = (n: number) => Math.round(n).toLocaleString("es-ES");
const pct = (n: number) => `${Math.round(n * 100)} %`;
const anos = (n: number | null) => (n === null ? "no amortiza" : `${n.toLocaleString("es-ES")} años`);

interface Fila {
  etiqueta: string;
  sin: string;
  con: string;
  /** Si la diferencia merece destacarse. */
  destacar?: boolean;
}

/**
 * Los dos escenarios, uno al lado del otro.
 *
 * La pregunta real delante de un preestudio no es cuanto se ahorra, sino si
 * compensa la bateria. Obligar a marcar una casilla, recalcular y recordar de
 * memoria las cifras anteriores traslada al cliente una comparacion que la
 * aplicacion puede hacer sola, y que ademas es barata: ambos escenarios
 * comparten la radiacion, que es lo unico caro de calcular.
 */
export function BatteryComparison({
  sinBateria,
  conBateria,
  verdict,
  actual,
}: {
  sinBateria: ScenarioSummary;
  conBateria: ScenarioSummary;
  verdict: ScenarioVerdict;
  /** Cual de los dos es el que se esta mostrando arriba. */
  actual: boolean;
}) {
  const filas: Fila[] = [
    {
      etiqueta: "Potencia",
      sin: `${sinBateria.recommendedKWp.toLocaleString("es-ES")} kWp`,
      con: `${conBateria.recommendedKWp.toLocaleString("es-ES")} kWp`,
    },
    {
      etiqueta: "Almacenamiento",
      sin: "—",
      con: `${conBateria.batteryKWh.toLocaleString("es-ES")} kWh`,
    },
    {
      etiqueta: "Inversión",
      sin: `${eur(sinBateria.netInvestmentEUR)} €`,
      con: `${eur(conBateria.netInvestmentEUR)} €`,
      destacar: true,
    },
    {
      etiqueta: "Cubre de tu consumo",
      sin: pct(sinBateria.selfSufficiencyRatio),
      con: pct(conBateria.selfSufficiencyRatio),
      destacar: true,
    },
    {
      etiqueta: "Ahorro el primer año",
      sin: `${eur(sinBateria.firstYearSavingsEUR)} €`,
      con: `${eur(conBateria.firstYearSavingsEUR)} €`,
    },
    {
      etiqueta: "Retorno",
      sin: anos(sinBateria.paybackYears),
      con: anos(conBateria.paybackYears),
      destacar: true,
    },
    {
      etiqueta: "Ahorro a 25 años",
      sin: `${eur(sinBateria.lifetimeSavingsEUR)} €`,
      con: `${eur(conBateria.lifetimeSavingsEUR)} €`,
    },
  ];

  return (
    <>
      <table className="w-full text-sm">
        <caption className="sr-only">
          Comparación entre la instalación sin batería y con batería
        </caption>
        <thead>
          <tr className="text-left text-xs text-mist-dim">
            <th scope="col" className="pb-2 font-medium">
              Concepto
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Sin batería {!actual && <span className="text-sun">· mostrado</span>}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Con batería {actual && <span className="text-sun">· mostrado</span>}
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.etiqueta} className="border-t border-line">
              <td className="py-2 text-mist">{f.etiqueta}</td>
              <td
                className="tabular py-2 text-right"
                style={f.destacar && !actual ? { color: "var(--color-sun)" } : undefined}
              >
                {f.sin}
              </td>
              <td
                className="tabular py-2 text-right"
                style={f.destacar && actual ? { color: "var(--color-sun)" } : undefined}
              >
                {f.con}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 border-l-2 border-sun pl-4">
        <p className="text-sm leading-relaxed text-snow">
          La batería cuesta{" "}
          <span className="tabular">{eur(verdict.extraCostEUR)} €</span> más y te cubre{" "}
          <span className="tabular">
            {verdict.extraSelfSufficiencyPoints.toLocaleString("es-ES")} puntos
          </span>{" "}
          más de consumo.{" "}
          {verdict.paysForItself
            ? "A veinticinco años devuelve más de lo que cuesta."
            : "A veinticinco años no llega a devolver lo que cuesta."}
        </p>

        <p className="mt-2 text-xs leading-relaxed text-mist-dim">
          {verdict.paysForItself
            ? "Aun así, el cálculo usa precios de catálogo de demostración: con precios reales la conclusión puede cambiar."
            : "Eso no la descarta. Una batería también da respaldo ante cortes de suministro y aprovecha el excedente que de otro modo se regala a la red, y ninguna de esas dos cosas aparece en un plazo de recuperación."}
        </p>
      </div>
    </>
  );
}
