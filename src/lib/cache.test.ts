import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { memoizeAsync, withTimeout } from "./cache";

describe("memoizeAsync", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("llama una sola vez para la misma clave", async () => {
    const fn = vi.fn(async (n: number) => n * 2);
    const memo = memoizeAsync(fn, (n) => String(n), { ttlMs: 1000 });

    expect(await memo(2)).toBe(4);
    expect(await memo(2)).toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("distingue claves distintas", async () => {
    const fn = vi.fn(async (n: number) => n * 2);
    const memo = memoizeAsync(fn, (n) => String(n), { ttlMs: 1000 });

    await memo(2);
    await memo(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("vuelve a llamar cuando la entrada caduca", async () => {
    const fn = vi.fn(async (n: number) => n * 2);
    const memo = memoizeAsync(fn, (n) => String(n), { ttlMs: 1000 });

    await memo(2);
    vi.advanceTimersByTime(1001);
    await memo(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("no cachea los errores: un fallo pasajero no se hereda", async () => {
    let intentos = 0;
    const fn = vi.fn(async () => {
      intentos += 1;
      if (intentos === 1) throw new Error("502 pasajero");
      return "bien";
    });
    const memo = memoizeAsync(fn, () => "k", { ttlMs: 10_000 });

    await expect(memo()).rejects.toThrow("502 pasajero");
    expect(await memo()).toBe("bien");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("comparte la peticion en vuelo entre llamadas simultaneas", async () => {
    let resolver: ((value: string) => void) | undefined;
    const fn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolver = resolve;
        }),
    );
    const memo = memoizeAsync(fn, () => "k", { ttlMs: 1000 });

    const a = memo();
    const b = memo();
    expect(fn).toHaveBeenCalledTimes(1);

    resolver?.("listo");
    expect(await a).toBe("listo");
    expect(await b).toBe("listo");
  });

  it("descarta entradas viejas al llegar al tope", async () => {
    const fn = vi.fn(async (n: number) => n);
    const memo = memoizeAsync(fn, (n) => String(n), { ttlMs: 10_000, maxEntries: 2 });

    await memo(1);
    await memo(2);
    await memo(3); // desaloja la clave 1
    await memo(1); // por tanto hay que recalcularla

    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe("withTimeout", () => {
  it("devuelve una senal que aun no esta abortada", () => {
    expect(withTimeout(1000).aborted).toBe(false);
  });

  it("se aborta si la senal externa se aborta", () => {
    const externa = new AbortController();
    const señal = withTimeout(10_000, externa.signal);
    externa.abort();
    expect(señal.aborted).toBe(true);
  });
});
