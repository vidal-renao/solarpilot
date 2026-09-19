/**
 * Consentimiento versionado.
 *
 * El error habitual es guardar un booleano: `acepto = true`. Eso no demuestra
 * nada. Si manana cambia el texto del formulario, no hay forma de saber que
 * acepto exactamente quien firmo ayer, y el registro pierde todo valor
 * probatorio justo cuando hace falta.
 *
 * Aqui se guarda el texto literal mostrado y la version que lo identifica.
 * Cambiar el texto obliga a crear una version nueva; los registros antiguos
 * siguen apuntando a la suya y quedan intactos.
 *
 * Alcance declarado: esto es un proyecto de demostracion. El texto es
 * plausible, no una clausula revisada por un abogado, y asi consta en la
 * interfaz.
 */

export interface ConsentVersion {
  version: string;
  effectiveFrom: string;
  /** Finalidades concretas autorizadas. Una casilla, una finalidad. */
  purpose: string;
  /** Texto exacto mostrado junto a la casilla. Se almacena tal cual. */
  text: string;
}

export const CONSENT_VERSIONS: Record<string, ConsentVersion> = {
  "preestudio-1.0": {
    version: "preestudio-1.0",
    effectiveFrom: "2026-09-19",
    purpose: "Elaborar el preestudio solicitado y ponerse en contacto para comentarlo.",
    text:
      "Acepto que SolarPilot use los datos que he facilitado para preparar mi " +
      "preestudio y contactarme para comentarlo. Puedo retirar este " +
      "consentimiento en cualquier momento. No se cederan mis datos a terceros " +
      "ni se usaran para enviarme publicidad de otros productos.",
  },
};

/** La version vigente. Es lo que se muestra a quien entra hoy. */
export const CURRENT_CONSENT = "preestudio-1.0";

export function currentConsent(): ConsentVersion {
  const consent = CONSENT_VERSIONS[CURRENT_CONSENT];
  if (!consent) throw new Error(`Falta la version de consentimiento ${CURRENT_CONSENT}`);
  return consent;
}

/**
 * Recupera una version concreta, incluidas las retiradas.
 *
 * Nunca se borra una version: un registro de consentimiento que apunta a un
 * texto inexistente es un registro inservible.
 */
export function consentVersion(version: string): ConsentVersion | undefined {
  return CONSENT_VERSIONS[version];
}
