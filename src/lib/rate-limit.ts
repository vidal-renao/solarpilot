/**
 * Limitacion de peticiones para las acciones de servidor.
 *
 * Existe por una razon concreta y no por higiene: cada calculo golpea PVGIS y
 * Nominatim. La politica de uso de Nominatim limita a una peticion por
 * segundo y bloquea a quien abusa, de modo que un bot dandole al boton deja
 * la aplicacion sin geocodificador, y no solo durante el ataque.
 *
 * Algoritmo: ventana deslizante por clave. Se guardan las marcas de tiempo de
 * las peticiones recientes y se cuentan las que caen dentro de la ventana. Es
 * mas justo que el cubo fijo, donde alguien puede gastar la cuota entera al
 * final de un periodo y otra vez al principio del siguiente.
 *
 * Limitacion asumida y declarada: vive en memoria del proceso. En un
 * despliegue con varias instancias cada una lleva su cuenta, asi que el tope
 * real es el configurado por el numero de instancias activas. Frena el abuso
 * casual y accidental, que es el que se ve en un proyecto como este; frenar a
 * alguien decidido exige almacenamiento compartido, y eso es Redis.
 */

export interface RateLimitRule {
  /** Peticiones permitidas dentro de la ventana. */
  limit: number;
  /** Duracion de la ventana en milisegundos. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Peticiones que aun quedan en la ventana actual. */
  remaining: number;
  /** Milisegundos hasta que se libere un hueco. 0 si hay sitio. */
  retryAfterMs: number;
}

interface Bucket {
  hits: number[];
  /** Para poder limpiar las claves que dejaron de usarse. */
  lastSeen: number;
}

const buckets = new Map<string, Bucket>();

/** Tope de claves vivas. Evita que una avalancha de IP infle la memoria. */
const MAX_KEYS = 5000;

function prune(now: number, windowMs: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastSeen > windowMs * 2) buckets.delete(key);
  }
  // Si aun asi sigue lleno, se vacia entero: perder la cuenta es preferible a
  // crecer sin limite, y el efecto practico es una ventana que se reinicia.
  if (buckets.size >= MAX_KEYS) buckets.clear();
}

/**
 * Consume una peticion de la cuota de `key`.
 *
 * Solo cuenta cuando se permite: una peticion rechazada no gasta cuota, de
 * modo que insistir no alarga el castigo.
 */
export function consume(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  prune(now, rule.windowMs);

  const desde = now - rule.windowMs;
  const bucket = buckets.get(key) ?? { hits: [], lastSeen: now };

  const recientes = bucket.hits.filter((t) => t > desde);

  if (recientes.length >= rule.limit) {
    const masAntigua = recientes[0] ?? now;
    buckets.set(key, { hits: recientes, lastSeen: now });
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, masAntigua + rule.windowMs - now),
    };
  }

  recientes.push(now);
  buckets.set(key, { hits: recientes, lastSeen: now });

  return {
    allowed: true,
    remaining: rule.limit - recientes.length,
    retryAfterMs: 0,
  };
}

/** Vacia el estado. Solo para pruebas. */
export function __resetRateLimit(): void {
  buckets.clear();
}

/**
 * Identifica a quien pide, a partir de las cabeceras del proxy.
 *
 * Detras de un proxy, `x-forwarded-for` trae la cadena de direcciones y la
 * primera es la del cliente. Sin cabecera se agrupa todo bajo una clave
 * comun: es un limite compartido y deliberadamente conservador, porque no
 * poder identificar a nadie no es razon para no limitar a ninguno.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const primera = forwarded.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return headers.get("x-real-ip")?.trim() || "desconocido";
}

/** Redondea a segundos para poder decirselo a una persona. */
export function retryAfterSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}
