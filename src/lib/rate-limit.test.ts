import { beforeEach, describe, expect, it } from "vitest";

import { __resetRateLimit, clientKey, consume, retryAfterSeconds } from "./rate-limit";

const regla = { limit: 3, windowMs: 10_000 };

beforeEach(() => __resetRateLimit());

describe("consume", () => {
  it("deja pasar hasta el limite", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(consume("a", regla).allowed).toBe(true);
    }
  });

  it("bloquea a partir del limite", () => {
    for (let i = 0; i < 3; i += 1) consume("a", regla);
    expect(consume("a", regla).allowed).toBe(false);
  });

  it("va descontando lo que queda", () => {
    expect(consume("a", regla).remaining).toBe(2);
    expect(consume("a", regla).remaining).toBe(1);
    expect(consume("a", regla).remaining).toBe(0);
  });

  it("cada clave lleva su propia cuenta", () => {
    for (let i = 0; i < 3; i += 1) consume("a", regla);
    expect(consume("a", regla).allowed).toBe(false);
    expect(consume("b", regla).allowed).toBe(true);
  });

  it("libera cuota segun se desliza la ventana", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i += 1) consume("a", regla, t0);
    expect(consume("a", regla, t0 + 5_000).allowed).toBe(false);
    // Pasada la ventana entera, las tres marcas han caducado.
    expect(consume("a", regla, t0 + 10_001).allowed).toBe(true);
  });

  it("es deslizante y no de bloques fijos", () => {
    const t0 = 1_000_000;
    consume("a", regla, t0);
    consume("a", regla, t0 + 9_000);
    consume("a", regla, t0 + 9_500);
    // La primera ya caduco, asi que hay un hueco; las otras dos no.
    expect(consume("a", regla, t0 + 10_100).allowed).toBe(true);
    expect(consume("a", regla, t0 + 10_200).allowed).toBe(false);
  });

  it("insistir no alarga el castigo: lo rechazado no gasta cuota", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i += 1) consume("a", regla, t0);
    // Diez intentos fallidos mientras esta bloqueado.
    for (let i = 0; i < 10; i += 1) consume("a", regla, t0 + 1_000);
    // Al caducar la ventana original, vuelve a poder pedir.
    expect(consume("a", regla, t0 + 10_001).allowed).toBe(true);
  });

  it("dice cuanto falta para volver a intentarlo", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i += 1) consume("a", regla, t0);
    const r = consume("a", regla, t0 + 4_000);
    expect(r.retryAfterMs).toBe(6_000);
  });
});

describe("clientKey", () => {
  it("toma la primera direccion de la cadena del proxy", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" });
    expect(clientKey(h)).toBe("203.0.113.7");
  });

  it("acepta la cabecera alternativa", () => {
    expect(clientKey(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("sin cabeceras agrupa bajo una clave comun", () => {
    // Limite compartido y conservador: no identificar a nadie no es motivo
    // para no limitar a ninguno.
    expect(clientKey(new Headers())).toBe("desconocido");
  });
});

describe("retryAfterSeconds", () => {
  it("redondea hacia arriba y nunca dice cero", () => {
    expect(retryAfterSeconds(1)).toBe(1);
    expect(retryAfterSeconds(4_200)).toBe(5);
    expect(retryAfterSeconds(0)).toBe(1);
  });
});
