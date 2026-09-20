import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const alt =
  "Del preestudio al primer kWh: los once pasos de una instalación de autoconsumo, con plazos y responsables.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: "Qué pasa después del preestudio",
    title: "Del preestudio al primer kWh",
    subtitle:
      "Once pasos, quién ejecuta cada uno y cuánto tarda. Más de la mitad del plazo no lo controla ninguna instaladora.",
  });
}
