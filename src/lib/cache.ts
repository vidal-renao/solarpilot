/**
 * Memoria de corta duracion para respuestas de servicios externos.
 *
 * Existe por dos razones concretas, no por optimizar a ciegas:
 *
 * 1. Nominatim limita a una peticion por segundo y bloquea a quien abusa. Un
 *    formulario publico sin cache se gana el bloqueo en una tarde.
 * 2. Google Solar, cuando se encienda, se cobra por consulta. Repetir la misma
 *    coordenada es dinero tirado.
 *
 * La radiacion de un punto y la geocodificacion de una direccion no cambian de
 * un minuto a otro, asi que cachearlas es correcto, no una trampa.
 *
 * Limitacion asumida: vive en memoria del proceso. En un despliegue con varias
 * instancias cada una tiene la suya, y un reinicio la vacia. Para el volumen
 * de este proyecto sobra; con trafico real esto va a Redis o al cache de datos
 * del framework.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export interface MemoOptions {
  /** Tiempo de vida en milisegundos. */
  ttlMs: number;
  /** Tope de entradas. Al llegar se descarta la mas antigua. */
  maxEntries?: number;
}

/**
 * Envuelve una funcion asincrona con cache por clave.
 *
 * Los errores no se cachean a proposito: si PVGIS falla, la siguiente
 * peticion debe volver a intentarlo, no heredar el fallo durante horas.
 * Las peticiones en vuelo si se comparten, para que diez usuarios simultaneos
 * pidiendo lo mismo no disparen diez llamadas.
 */
export function memoizeAsync<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyOf: (...args: Args) => string,
  { ttlMs, maxEntries = 500 }: MemoOptions,
): (...args: Args) => Promise<Result> {
  const settled = new Map<string, Entry<Result>>();
  const inFlight = new Map<string, Promise<Result>>();

  return async (...args: Args): Promise<Result> => {
    const key = keyOf(...args);
    const now = Date.now();

    const hit = settled.get(key);
    if (hit && hit.expiresAt > now) return hit.value;
    if (hit) settled.delete(key);

    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = fn(...args)
      .then((value) => {
        if (settled.size >= maxEntries) {
          const oldest = settled.keys().next();
          if (!oldest.done) settled.delete(oldest.value);
        }
        settled.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, promise);
    return promise;
  };
}

/**
 * Combina un tiempo maximo con la senal de cancelacion que llegue de fuera.
 *
 * Sin esto, un servicio externo que no cierra la conexion deja la accion de
 * servidor colgada hasta que el propio despliegue la corta, y el usuario ve
 * una pagina que no responde sin saber por que.
 */
export function withTimeout(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return external ? AbortSignal.any([external, timeout]) : timeout;
}
