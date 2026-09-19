"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { advanceLead } from "@/app/actions";
import { LEAD_STATES, leadStateLabel, STATES_REQUIRING_REASON, type LeadState } from "@/lib/lead-states";


/**
 * Cambia el estado de un lead.
 *
 * Perder un lead abre un campo de motivo obligatorio. No es friccion gratuita:
 * un embudo lleno de "perdido" sin causa no permite averiguar nada despues, y
 * la razon mas comun en solar —cubierta inviable— es justo la que conviene
 * detectar antes en la cualificacion.
 */
export function LeadStateControl({ leadId, state }: { leadId: string; state: LeadState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const aplicar = (next: LeadState, reason?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await advanceLead(leadId, next, reason);
      if (!result.ok) {
        setError(result.error ?? "No se ha podido mover");
        return;
      }
      setPidiendoMotivo(false);
      setMotivo("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <select
        value={state}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as LeadState;
          if (STATES_REQUIRING_REASON.has(next)) {
            setPidiendoMotivo(true);
            return;
          }
          aplicar(next);
        }}
        className="rounded border border-line bg-ink px-2 py-1 text-xs text-snow focus:border-sun focus:outline-none disabled:opacity-50"
        aria-label="Estado del lead"
      >
        {LEAD_STATES.map((value) => (
          <option key={value} value={value}>
            {leadStateLabel(value)}
          </option>
        ))}
      </select>

      {pidiendoMotivo && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Motivo de la pérdida"
            className="w-48 rounded border border-line bg-ink px-2 py-1 text-xs text-snow placeholder:text-mist-dim focus:border-sun focus:outline-none"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => aplicar("perdido", motivo)}
            className="rounded bg-sun px-2 py-1 text-xs font-medium text-ink disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              setPidiendoMotivo(false);
              setError(null);
            }}
            className="text-xs text-mist-dim hover:text-mist"
          >
            Cancelar
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-sun">
          {error}
        </p>
      )}
    </div>
  );
}
