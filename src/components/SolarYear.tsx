const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;
const NOMBRES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/**
 * El arco solar: la produccion mes a mes.
 *
 * Es la forma del ano en ese tejado concreto. En Espana el verano casi dobla
 * al invierno, y ver esa curva explica mejor que cualquier parrafo por que un
 * preestudio se hace sobre el ano entero y no sobre un dia bueno.
 */
export function SolarYear({
  monthlyKWh,
  className = "",
}: {
  monthlyKWh: number[];
  className?: string;
}) {
  const max = Math.max(...monthlyKWh, 1);
  const min = Math.min(...monthlyKWh);
  const mesActual = new Date().getMonth();

  return (
    <figure className={className}>
      <figcaption className="mb-4 flex items-baseline justify-between gap-4">
        <span className="font-display text-xs font-medium uppercase tracking-[0.18em] text-mist-dim">
          Produccion mes a mes
        </span>
        <span className="tabular text-xs text-mist-dim">kWh</span>
      </figcaption>

      <div className="flex h-40 items-end gap-[3px] sm:gap-1.5">
        {monthlyKWh.map((kWh, i) => {
          const alto = Math.max(2, (kWh / max) * 100);
          const esActual = i === mesActual;
          /* El brillo sigue a la produccion: el arco luce en verano y se
             apaga en invierno. La intensidad es el dato, no un adorno. */
          const intensidad = max === min ? 1 : (kWh - min) / (max - min);
          return (
            <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className="bar-rise relative w-full rounded-t-[2px]"
                style={{
                  height: `${alto}%`,
                  animationDelay: `${i * 45}ms`,
                  backgroundColor: "var(--color-sun)",
                  opacity: esActual ? 1 : 0.34 + intensidad * 0.42,
                }}
              >
                {/* Valor anclado a la barra, no al contenedor. */}
                <span
                  aria-hidden
                  className="tabular pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-snow opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {Math.round(kWh)}
                </span>
              </div>
              <span className="sr-only">
                {NOMBRES[i]}: {Math.round(kWh)} kilovatios hora
              </span>
            </div>
          );
        })}
      </div>

      <div aria-hidden className="mt-2 flex gap-[3px] sm:gap-1.5">
        {MESES.map((m, i) => (
          <span
            key={i}
            className="tabular flex-1 text-center text-[10px]"
            style={{ color: i === mesActual ? "var(--color-sun)" : "var(--color-mist-dim)" }}
          >
            {m}
          </span>
        ))}
      </div>
    </figure>
  );
}
