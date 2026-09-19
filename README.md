# SolarPilot

Preestudio solar para una instaladora fotovoltaica española: una dirección y un consumo entran, y salen cuántos paneles caben, cuánto producen, cuánto ahorran y en cuánto tiempo se pagan.

Lo que lo separa de cualquier otro calculador solar es que **también dice cuánto se fía de sus propios números**. Cada cifra arrastra de dónde sale, y la confianza global es la del eslabón más débil: si la radiación viene de una fuente oficial pero el consumo lo has sacado de una factura, el preestudio sale marcado como confianza **baja**, no alta.

**→ [Ver funcionando](https://solarpilot-psi.vercel.app)**

> **Proyecto de demostración.** La empresa no existe y los precios son de un catálogo ficticio. Los datos de radiación sí son reales: los sirve PVGIS, el servicio del Joint Research Centre de la Comisión Europea.

<!--
CAPTURAS PENDIENTES. Añadir aquí, por este orden:
  docs/calculador.png  — el resultado con el arco solar
  docs/propuesta.png   — la propuesta imprimible
  docs/pipeline.png    — la vista interna
-->

---

## La decisión que sostiene todo el diseño

Un preestudio solar mezcla datos de calidades muy distintas. La radiación está medida. El consumo puede venir de la curva horaria del contador, de una factura, o de un perfil estadístico. La cubierta casi nunca se conoce. Un calculador normal los mezcla y devuelve un número redondo con dos decimales, que transmite una precisión que no tiene.

Aquí ningún número viaja solo:

```ts
export interface Traced<T> {
  value: T;
  provenance: Provenance;   // de qué fuente, con qué parámetros y cuándo
  confidence: Confidence;   // alta | media | baja
}
```

Y la confianza se propaga hacia abajo, nunca hacia arriba:

```ts
export function weakestConfidence(...values: Confidence[]): Confidence {
  if (values.includes("baja")) return "baja";
  if (values.includes("media")) return "media";
  return "alta";
}
```

Eso tiene una consecuencia comercial incómoda y deliberada: el informe **abre con la confianza, antes que con ningún euro**. Es lo contrario de lo que hace el software del sector, y es lo que convierte una estimación en algo defendible delante de un cliente o de un técnico.

El resto sale de ahí. Los supuestos se declaran en lugar de esconderse en constantes. La escalada del precio de la luz se fija en cero a propósito, porque es el supuesto más fácil de usar para inflar un retorno: el plazo que se muestra es un suelo, no una expectativa.

---

## Qué es real y qué está simulado

Un portfolio que no distingue esto no vale nada.

| Pieza | Estado |
|---|---|
| Radiación y producción | **Real.** PVGIS v5.2, verificado contra el servicio en vivo |
| Geocodificación | **Real.** Nominatim (OpenStreetMap) |
| Motor de cálculo | **Real.** Dimensionado, balance y economía, con 72 pruebas |
| Base de datos | **Real.** Postgres en Supabase, con migraciones versionadas |
| Precios de instalación | **Ficticios.** Catálogo de demostración, tramos plausibles |
| Datos de cubierta | **Apagado.** Google Solar está implementado pero sin clave |

Sobre lo último: `src/lib/solar/roof.ts` contiene el cliente de Google Solar entero —parseo de segmentos, conversión de azimut de la convención de Google a la de PVGIS, tratamiento del 404 como ausencia de cobertura y no como avería—. Sin `GOOGLE_SOLAR_API_KEY` el adaptador se declara no configurado y la cadena cae a la superficie que declare el usuario. Encenderlo es poner la variable de entorno.

**Ese cliente está escrito contra la documentación, no contra el servicio.** El de PVGIS sí se verificó en vivo. Antes de darlo por bueno hay que ejecutarlo una vez con clave real y confirmar la forma de la respuesta.

---

## Cómo está organizado

```
src/
├── lib/
│   ├── solar/
│   │   ├── types.ts        Dominio. Procedencia y confianza incorporadas
│   │   ├── assumptions.ts  Todo lo configurable, en un solo sitio
│   │   ├── pvgis.ts        Comisión Europea. Parseo defensivo campo a campo
│   │   ├── geocode.ts      Nominatim
│   │   ├── roof.ts         Fuentes de cubierta con respaldo ordenado
│   │   └── engine.ts       Dimensionado, balance y economía. Funciones puras
│   ├── db/                 Esquema Postgres, cliente y repositorio
│   ├── consent.ts          Consentimiento versionado
│   └── cache.ts            Memoria corta y tiempos máximos de red
└── app/
    ├── page.tsx            Calculador
    ├── pipeline/           Vista interna
    ├── propuesta/[id]/     Documento imprimible
    └── actions.ts          Acciones de servidor
```

Tres decisiones que merecen explicación:

**El motor no toca la red.** PVGIS entra como parámetro ya resuelto. El cálculo es determinista y se prueba sin simulacros: misma entrada, misma salida.

**El servidor recalcula el preestudio al guardarlo** en lugar de aceptar el que venga del navegador, que podría haberse manipulado. Con geocodificación y radiación cacheadas, recalcular es casi gratis.

**La propuesta reutiliza los componentes de pantalla sobre fondo claro.** Como los tokens de color son variables CSS, basta redefinirlas en un envoltorio `.paper`. No hay un segundo juego de plantillas que mantener sincronizado.

---

## Arrancar

Node 20 o superior.

```bash
npm install
cp .env.example .env.local   # y apuntar DATABASE_URL a un Postgres
npm run db:push              # crea el esquema
npm run db:seed              # seis leads con preestudios calculados de verdad
npm run dev
```

Necesita un Postgres, pero ninguna clave de API. **Las pruebas no lo necesitan**: corren contra PGlite, Postgres compilado a WebAssembly, así que `npm test` funciona con solo clonar e instalar.

El sembrado llama a PVGIS y a Nominatim de verdad, así que tarda unos segundos y respeta el límite de una petición por segundo.

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | 72 pruebas |
| `npm run typecheck` | TypeScript en modo estricto |
| `npm run lint` | ESLint |
| `npm run build` | Compilación de producción |
| `npm run db:generate` | Genera migración tras cambiar el esquema |

### Variables de entorno

Todas opcionales. Ver `.env.example`.

| Variable | Por defecto |
|---|---|
| `DATABASE_URL` | Sin valor por defecto. En Supabase, la cadena del agrupador en modo transacción, puerto 6543 |
| `GOOGLE_SOLAR_API_KEY` | Sin definir: la fuente automática de cubierta queda apagada |
| `GEOCODER_USER_AGENT` | Nominatim exige identificarse |

---

## Qué falta, y se sabe

Un proyecto honesto dice dónde termina.

**El reparto entre autoconsumo y excedente es un perfil estadístico**, no un cálculo. Es el supuesto que más mueve el ahorro y puede desviarse entre diez y veinte puntos. Se resuelve con la curva de carga horaria del punto de suministro, que en España se obtiene con autorización del titular. Requiere un NIF real, así que queda fuera de una demostración.

**No hay incentivos.** Las bonificaciones municipales sobre impuestos locales y las deducciones fiscales cambian el retorno de forma material y dependen del municipio. Modelarlas bien es un paquete normativo por territorio con vigencia y fuente citada, no una constante.

**La acción de servidor no tiene limitación de peticiones.** En un despliegue público hay que ponerla antes de nada: el cálculo consume cuota de servicios de terceros.

**El cache vive en memoria del proceso.** Con varias instancias cada una tiene la suya. Con tráfico real esto va a Redis.

**Las tablas van prefijadas con `solar_`** porque la base puede compartirse con otras aplicaciones. `drizzle-kit` está configurado con `tablesFilter` para que solo mire lo suyo: sin eso, propondría borrar tablas ajenas en la primera migración.

**El PDF se genera con el diálogo de impresión del navegador.** La hoja de estilos produce un documento correcto y evita arrastrar una librería de maquetación. El día que haya que enviar el PDF por correo sin intervención humana, habrá que renderizarlo en servidor.
