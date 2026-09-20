import { ImageResponse } from "next/og";

/**
 * Tarjeta de vista previa para redes y mensajeria.
 *
 * Sin esto, pegar el enlace en LinkedIn o en un chat produce un rectangulo
 * gris con la URL. Para un proyecto que se comparte por enlace, eso es la
 * primera impresion y se la estaba dejando al azar.
 *
 * Deliberadamente sin fuentes externas: `ImageResponse` puede cargarlas, pero
 * eso mete una peticion de red en el momento de generar la imagen y un punto
 * de fallo en el despliegue. El peso visual lo llevan el color y la
 * composicion, que no dependen de nadie.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const INK = "#0f1626";
const INK_RAISED = "#18203a";
const SUN = "#f5b544";
const SNOW = "#f4f6fb";
const MIST = "#a8b2cc";

/** El arco solar del ano, la forma que identifica al proyecto. */
const ARCO = [0.42, 0.48, 0.63, 0.64, 0.7, 0.72, 0.78, 0.76, 0.66, 0.56, 0.43, 0.4];

export function ogCard({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 2,
              color: MIST,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 76,
              lineHeight: 1.05,
              fontWeight: 600,
              color: SNOW,
              maxWidth: 900,
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 30,
              lineHeight: 1.4,
              color: MIST,
              maxWidth: 820,
            }}
          >
            {subtitle}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          {/* El arco: barras cuya altura sigue la produccion del ano. */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 9, height: 120 }}>
            {ARCO.map((v, i) => (
              <div
                key={i}
                style={{
                  width: 34,
                  height: Math.round(v * 120),
                  background: SUN,
                  opacity: 0.34 + v * 0.66,
                  borderRadius: "3px 3px 0 0",
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: INK_RAISED,
              padding: "14px 26px",
              borderRadius: 999,
              fontSize: 26,
              color: SNOW,
            }}
          >
            <span style={{ display: "flex", fontWeight: 600 }}>Solar</span>
            <span style={{ display: "flex", color: SUN, marginLeft: -12, fontWeight: 600 }}>
              Pilot
            </span>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
