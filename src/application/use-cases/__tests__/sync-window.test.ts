import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ventanaDesde, VENTANA_MAXIMA_DIAS, SOLAPE_DIAS } from "../sync-window";

const DIA_MS = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-08-12T12:00:00Z");
const haceDias = (n: number) => new Date(AHORA.getTime() - n * DIA_MS);
const diasAtras = (d: Date) => Math.round((AHORA.getTime() - d.getTime()) / DIA_MS);

describe("ventanaDesde", () => {
  test("sin sync previo arranca en el tope de 30 días", () => {
    assert.equal(diasAtras(ventanaDesde(AHORA, null)), VENTANA_MAXIMA_DIAS);
  });

  test("con sync reciente arranca desde ahí, no desde el tope", () => {
    // Sincronizó ayer: mira 1 + 2 de solape = 3 días atrás, no 30.
    assert.equal(diasAtras(ventanaDesde(AHORA, haceDias(1))), 1 + SOLAPE_DIAS);
  });

  // El caso que justifica el tope: no reventar trayendo 5 años de historia.
  test("con sync muy viejo se corta en 30 días", () => {
    assert.equal(diasAtras(ventanaDesde(AHORA, haceDias(120))), VENTANA_MAXIMA_DIAS);
  });

  // Y el que justifica que sea un tope y no una ventana fija: si fuera fija,
  // demorarse 5 semanas dejaría una semana de correos invisible para siempre.
  test("justo en el límite sigue cubriendo hasta el último sync", () => {
    assert.equal(diasAtras(ventanaDesde(AHORA, haceDias(20))), 20 + SOLAPE_DIAS);
  });

  test("nunca mira más de 30 días atrás, pase lo que pase", () => {
    for (const dias of [0, 1, 15, 29, 31, 90, 365, 2000]) {
      assert.ok(
        diasAtras(ventanaDesde(AHORA, haceDias(dias))) <= VENTANA_MAXIMA_DIAS,
        `con último sync hace ${dias} días se pasó del tope`
      );
    }
  });

  test("nunca arranca en el futuro", () => {
    assert.ok(ventanaDesde(AHORA, AHORA).getTime() <= AHORA.getTime());
  });
});
