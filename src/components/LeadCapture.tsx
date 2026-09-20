"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { captureStudy } from "@/app/actions";
import { currentConsent } from "@/lib/consent";

const inputBase =
  "w-full rounded border border-line bg-ink px-3 py-2.5 text-snow placeholder:text-mist-dim focus:border-sun focus:outline-none";
const labelBase = "mb-1.5 block text-xs uppercase tracking-wider text-mist-dim";

/**
 * Captura del lead, despues del resultado y nunca antes.
 *
 * Una instaladora real pondria este formulario delante del calculo para no
 * regalar el preestudio. Aqui va detras a proposito: es un proyecto de
 * demostracion y quien lo evalue tiene que poder ver el resultado sin dejar
 * sus datos.
 *
 * Los parametros del preestudio viajan en campos ocultos, pero el servidor no
 * se fia de ellos: los revalida y recalcula. Van aqui para reconstruir la
 * peticion, no como resultado de confianza.
 */
export function LeadCapture({
  studyFields,
}: {
  studyFields: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(captureStudy, null);
  const consent = currentConsent();

  // Campos controlados por el mismo motivo que en el calculador: React 19
  // vacia el formulario al terminar la accion, y un error de validacion no
  // deberia costarle al usuario volver a teclear sus datos.
  const [values, setValues] = useState({ name: "", email: "", phone: "", consent: false });
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const errorIn = (field: string) =>
    state && !state.ok && state.field === field ? state.error : undefined;

  if (state?.ok) {
    return (
      <section className="fade-up mt-6 rounded-lg border border-sun/40 bg-ink-raised p-6 sm:p-8">
        <h2 className="font-display text-xl font-medium">Preestudio guardado</h2>
        <p className="mt-2 max-w-prose leading-relaxed text-mist">
          Te hemos preparado la propuesta con estos numeros. El siguiente paso es una visita
          tecnica: es donde se comprueba la cubierta, las sombras y el cuadro electrico, y donde
          esta estimacion se convierte en un presupuesto en firme o se cae.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/propuesta/${state.leadId}`}
            className="rounded bg-sun px-5 py-2.5 font-display font-medium text-ink transition-opacity hover:opacity-90"
          >
            Ver la propuesta
          </Link>
          <Link
            href="/proceso"
            className="rounded border border-line px-5 py-2.5 font-display text-sm font-medium transition-colors hover:border-sun hover:text-sun"
          >
            Qué viene después
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-line bg-ink-raised p-6 sm:p-8">
      <h2 className="font-display text-xl font-medium">Guarda este preestudio</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-mist">
        Lo convertimos en una propuesta con tus datos y te la dejamos accesible por si quieres
        compartirla o consultarla luego.
      </p>

      <form action={formAction} className="mt-6">
        {/* Parametros de la peticion. El servidor los revalida y recalcula. */}
        {Object.entries(studyFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelBase} htmlFor="name">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              required
              autoComplete="name"
              className={inputBase}
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              aria-invalid={Boolean(errorIn("name"))}
            />
          </div>
          <div>
            <label className={labelBase} htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputBase}
              value={values.email}
              onChange={(event) => set("email", event.target.value)}
              aria-invalid={Boolean(errorIn("email"))}
            />
          </div>
          <div>
            <label className={labelBase} htmlFor="phone">
              Telefono <span className="normal-case tracking-normal">(opcional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              className={inputBase}
              value={values.phone}
              onChange={(event) => set("phone", event.target.value)}
            />
          </div>
        </div>

        {/*
          El texto del consentimiento se muestra entero, no detras de un
          enlace, y es exactamente el que queda almacenado junto al registro.
        */}
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded border border-line bg-ink p-4">
          <input
            type="checkbox"
            name="consent"
            className="mt-0.5 accent-sun"
            checked={values.consent}
            onChange={(event) => set("consent", event.target.checked)}
            aria-invalid={Boolean(errorIn("consent"))}
          />
          <span className="text-sm leading-relaxed text-mist">
            {consent.text}
            <span className="mt-1 block text-xs text-mist-dim">
              Version {consent.version}. Se guarda este texto literal junto a tu registro.
            </span>
          </span>
        </label>

        {state && !state.ok && (
          <p role="alert" className="mt-4 border-l-2 border-sun pl-3 text-sm text-snow">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 rounded bg-sun px-6 py-2.5 font-display font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar y ver propuesta"}
        </button>
      </form>
    </section>
  );
}
