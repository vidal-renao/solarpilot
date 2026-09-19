"use client";

import { useActionState, useState } from "react";

import { createStudy } from "@/app/actions";

import { LeadCapture } from "./LeadCapture";

import { StudyResult } from "./StudyResult";

const inputBase =
  "w-full rounded border border-line bg-ink px-3 py-2.5 text-snow placeholder:text-mist-dim focus:border-sun focus:outline-none";
const labelBase = "mb-1.5 block text-xs uppercase tracking-wider text-mist-dim";

/**
 * React 19 vacia los campos no controlados cuando termina una accion de
 * formulario. Aqui eso es hostil: lo normal es calcular, mirar el resultado y
 * ajustar el consumo o la tarifa. Se controlan los campos para que el trabajo
 * del usuario sobreviva al envio.
 */
export function StudyForm() {
  const [state, formAction, pending] = useActionState(createStudy, null);

  const [values, setValues] = useState({
    address: "",
    annualKWh: "4500",
    importPrice: "0.22",
    exportPrice: "0.06",
    roofAreaM2: "",
    consumptionSource: "factura",
    withBattery: false,
  });

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const errorIn = (field: string) =>
    state && !state.ok && state.field === field ? state.error : undefined;

  return (
    <>
      <form action={formAction} className="mt-10">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className={labelBase} htmlFor="address">
                Direccion
              </label>
              <input
                id="address"
                name="address"
                required
                autoComplete="street-address"
                placeholder="Calle Mayor 1, Alcala de Henares"
                className={inputBase}
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
                aria-invalid={Boolean(errorIn("address"))}
                aria-describedby={errorIn("address") ? "form-error" : undefined}
              />
            </div>
            <div>
              <label className={labelBase} htmlFor="annualKWh">
                Consumo al año
              </label>
              <div className="relative">
                <input
                  id="annualKWh"
                  name="annualKWh"
                  type="number"
                  required
                  min={1}
                  step={1}
                  className={`${inputBase} tabular pr-12`}
                  value={values.annualKWh}
                  onChange={(e) => set("annualKWh", e.target.value)}
                  aria-invalid={Boolean(errorIn("annualKWh"))}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mist-dim">
                  kWh
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="h-fit self-end rounded bg-sun px-6 py-2.5 font-display font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Calculando…" : "Calcular"}
          </button>
        </div>

        <details className="mt-5">
          <summary className="cursor-pointer text-xs text-mist-dim transition-colors hover:text-mist">
            Ajustar tarifa, cubierta y bateria
          </summary>

          <div className="mt-4 grid gap-4 rounded border border-line bg-ink-raised p-4 sm:grid-cols-4">
            <div>
              <label className={labelBase} htmlFor="importPrice">
                Precio de compra
              </label>
              <input
                id="importPrice"
                name="importPrice"
                type="number"
                step="0.001"
                min="0.001"
                className={`${inputBase} tabular`}
                value={values.importPrice}
                onChange={(e) => set("importPrice", e.target.value)}
              />
              <p className="mt-1 text-[11px] text-mist-dim">€/kWh con impuestos</p>
            </div>

            <div>
              <label className={labelBase} htmlFor="exportPrice">
                Compensacion
              </label>
              <input
                id="exportPrice"
                name="exportPrice"
                type="number"
                step="0.001"
                min="0"
                className={`${inputBase} tabular`}
                value={values.exportPrice}
                onChange={(e) => set("exportPrice", e.target.value)}
              />
              <p className="mt-1 text-[11px] text-mist-dim">€/kWh de excedente</p>
            </div>

            <div>
              <label className={labelBase} htmlFor="roofAreaM2">
                Cubierta
              </label>
              <input
                id="roofAreaM2"
                name="roofAreaM2"
                type="number"
                min="1"
                placeholder="—"
                className={`${inputBase} tabular`}
                value={values.roofAreaM2}
                onChange={(e) => set("roofAreaM2", e.target.value)}
              />
              <p className="mt-1 text-[11px] text-mist-dim">m² disponibles</p>
            </div>

            <div>
              <label className={labelBase} htmlFor="consumptionSource">
                Origen del consumo
              </label>
              <select
                id="consumptionSource"
                name="consumptionSource"
                className={inputBase}
                value={values.consumptionSource}
                onChange={(e) => set("consumptionSource", e.target.value)}
              >
                <option value="factura">Factura electrica</option>
                <option value="curva_horaria">Curva horaria</option>
                <option value="perfil_tipo">Estimacion</option>
              </select>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-mist">
                <input
                  type="checkbox"
                  name="withBattery"
                  className="accent-sun"
                  checked={values.withBattery}
                  onChange={(e) => set("withBattery", e.target.checked)}
                />
                Con bateria
              </label>
            </div>
          </div>
        </details>

        {state && !state.ok && (
          <p id="form-error" role="alert" className="mt-4 border-l-2 border-sun pl-3 text-sm text-snow">
            {state.error}
          </p>
        )}
      </form>

      {state?.ok && (
        <div className="mt-12">
          <StudyResult
            study={state.study}
            roof={state.roof}
            addressPrecise={state.addressPrecise}
          />
          <LeadCapture
            studyFields={{
              address: values.address,
              annualKWh: values.annualKWh,
              importPrice: values.importPrice,
              exportPrice: values.exportPrice,
              roofAreaM2: values.roofAreaM2,
              consumptionSource: values.consumptionSource,
              ...(values.withBattery ? { withBattery: "on" } : {}),
            }}
          />
        </div>
      )}
    </>
  );
}
