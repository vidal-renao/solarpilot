import { describe, expect, it } from "vitest";

import { estimateIncentives, PROGRAMS } from "./incentives";

const base = {
  investmentEUR: 6000,
  isResidential: true,
  meetsIrpfConditions: true,
};

describe("estimateIncentives", () => {
  it("aplica el 40 % del IRPF cuando se cumplen las condiciones", () => {
    const r = estimateIncentives(base);
    const irpf = r.applied.find((e) => e.program.id === "irpf_40");
    expect(irpf?.amountEUR).toBeCloseTo(2400); // 40 % de 6.000
  });

  it("limita la base de la deduccion al maximo legal", () => {
    // 20.000 EUR de inversion, pero la base se topa en 7.500.
    const r = estimateIncentives({ ...base, investmentEUR: 20_000 });
    const irpf = r.applied.find((e) => e.program.id === "irpf_40");
    expect(irpf?.amountEUR).toBeCloseTo(3000); // 40 % de 7.500, no de 20.000
    expect(irpf?.basis).toMatch(/limitada al maximo/i);
  });

  it("no descuenta la deduccion si no consta que se cumplan las condiciones", () => {
    const r = estimateIncentives({ ...base, meetsIrpfConditions: false });
    expect(r.applied.find((e) => e.program.id === "irpf_40")).toBeUndefined();
    expect(r.potential.find((e) => e.program.id === "irpf_40")).toBeDefined();
    expect(r.appliedTotalEUR).toBe(0);
  });

  it("no ofrece la deduccion del IRPF a una empresa", () => {
    const r = estimateIncentives({ ...base, isResidential: false });
    const todas = [...r.applied, ...r.potential];
    expect(todas.find((e) => e.program.id === "irpf_40")).toBeUndefined();
  });

  it("las bonificaciones municipales nunca se dan por aplicadas", () => {
    // Dependen de una ordenanza que no se ha verificado.
    const r = estimateIncentives({ ...base, annualIbiEUR: 400 });
    for (const id of ["ibi", "icio"]) {
      expect(r.applied.find((e) => e.program.id === id)).toBeUndefined();
      expect(r.potential.find((e) => e.program.id === id)).toBeDefined();
    }
  });

  it("omite el IBI cuando el cliente no ha dicho cuanto paga", () => {
    const r = estimateIncentives(base);
    expect(r.potential.find((e) => e.program.id === "ibi")).toBeUndefined();
  });

  it("los totales cuadran con el detalle", () => {
    const r = estimateIncentives({ ...base, annualIbiEUR: 400 });
    expect(r.appliedTotalEUR).toBeCloseTo(
      r.applied.reduce((s, e) => s + e.amountEUR, 0),
      2,
    );
    expect(r.potentialTotalEUR).toBeCloseTo(
      r.potential.reduce((s, e) => s + e.amountEUR, 0),
      2,
    );
  });

  it("lo aplicado nunca supera la inversion", () => {
    const r = estimateIncentives({ ...base, investmentEUR: 1000 });
    expect(r.appliedTotalEUR).toBeLessThanOrEqual(1000);
  });
});

describe("catalogo de programas", () => {
  it("cada programa cita su fuente con fecha de consulta", () => {
    for (const program of Object.values(PROGRAMS)) {
      expect(program.source.url).toMatch(/^https:\/\//);
      expect(program.source.consultedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("cada programa declara sus requisitos en lugar de darlos por hechos", () => {
    for (const program of Object.values(PROGRAMS)) {
      expect(program.requirements.length).toBeGreaterThan(0);
    }
  });

  it("los programas municipales se marcan como potenciales, no aplicables", () => {
    for (const program of Object.values(PROGRAMS)) {
      if (program.scope === "municipal") {
        expect(program.status).toBe("potencial");
      }
    }
  });
});
