import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const alt =
  "SolarPilot: cuánto sol le cabe a tu tejado. Preestudio solar con la procedencia y la confianza de cada dato.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: "Preestudio solar",
    title: "Cuánto sol le cabe a tu tejado",
    subtitle:
      "Cuántos paneles caben, cuánto producen y en cuánto se pagan. Y también lo que no sabemos todavía.",
  });
}
