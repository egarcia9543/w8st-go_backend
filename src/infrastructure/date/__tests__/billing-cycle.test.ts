import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cicloDeFecha, cicloPorMes, cicloVigente } from "../billing-cycle";
import { diaBogota } from "../bogota";

const MS_DIA = 24 * 60 * 60 * 1000;

const enBogota = (iso: string) => new Date(`${iso}-05:00`);
const pad = (n: number) => String(n).padStart(2, "0");

describe("cicloDeFecha", () => {
  test("una compra antes del corte entra al ciclo que cierra ese mes", () => {
    assert.equal(cicloDeFecha(enBogota("2026-09-14T10:00:00"), 15, null).label, "2026-09");
  });

  test("una compra el día del corte todavía entra al ciclo que cierra", () => {
    assert.equal(cicloDeFecha(enBogota("2026-09-15T10:00:00"), 15, null).label, "2026-09");
  });

  test("una compra al día siguiente del corte pasa al ciclo siguiente", () => {
    assert.equal(cicloDeFecha(enBogota("2026-09-16T10:00:00"), 15, null).label, "2026-10");
  });

  test("el escenario que originó el cambio: compra del 20 de agosto con corte 15 se paga en el ciclo de septiembre", () => {
    const ciclo = cicloDeFecha(enBogota("2026-08-20T10:00:00"), 15, null);

    assert.equal(ciclo.label, "2026-09");
    assert.equal(diaBogota(ciclo.from), "2026-08-16");
    assert.equal(diaBogota(ciclo.closesOn), "2026-09-15");
  });

  test("una compra de la noche del día de corte no se escapa al ciclo siguiente por la zona horaria", () => {
    const nocheEnBogota = enBogota("2026-09-15T23:30:00");

    assert.equal(nocheEnBogota.toISOString().slice(0, 10), "2026-09-16");
    assert.equal(cicloDeFecha(nocheEnBogota, 15, null).label, "2026-09");
  });

  test("diciembre cruza de año", () => {
    assert.equal(cicloDeFecha(enBogota("2026-12-20T10:00:00"), 15, null).label, "2027-01");
  });

  test("con corte 31 el último día de un mes de 30 sigue siendo el cierre", () => {
    assert.equal(cicloDeFecha(enBogota("2026-09-30T10:00:00"), 31, null).label, "2026-09");
  });
});

describe("cicloPorMes", () => {
  test("la ventana va del día siguiente al corte anterior hasta el corte del mes", () => {
    const ciclo = cicloPorMes("2026-09", 15, null);

    assert.equal(diaBogota(ciclo.from), "2026-08-16");
    assert.equal(diaBogota(ciclo.closesOn), "2026-09-15");
    assert.equal(diaBogota(ciclo.to), "2026-09-16");
  });

  test("con corte 31 en marzo el corte anterior se ajusta al 28 de febrero", () => {
    const ciclo = cicloPorMes("2026-03", 31, null);

    assert.equal(diaBogota(ciclo.from), "2026-03-01");
    assert.equal(diaBogota(ciclo.closesOn), "2026-03-31");
  });

  test("con corte 31 en septiembre el cierre se ajusta al día 30", () => {
    const ciclo = cicloPorMes("2026-09", 31, null);

    assert.equal(diaBogota(ciclo.from), "2026-09-01");
    assert.equal(diaBogota(ciclo.closesOn), "2026-09-30");
    assert.equal(diaBogota(ciclo.to), "2026-10-01");
  });

  test("el ciclo de enero arranca en diciembre del año anterior", () => {
    assert.equal(diaBogota(cicloPorMes("2027-01", 15, null).from), "2026-12-16");
  });

  test("en año bisiesto el corte 31 de marzo arranca el 1 tras el 29 de febrero", () => {
    assert.equal(diaBogota(cicloPorMes("2028-03", 31, null).from), "2028-03-01");
    assert.equal(diaBogota(cicloPorMes("2028-02", 31, null).closesOn), "2028-02-29");
  });
});

describe("fecha límite de pago", () => {
  test("los días de gracia se cuentan desde el cierre y pueden cruzar de mes", () => {
    assert.equal(diaBogota(cicloPorMes("2026-09", 15, 18).paymentDueDate!), "2026-10-03");
  });

  test("sin días de gracia configurados no hay fecha de pago", () => {
    assert.equal(cicloPorMes("2026-09", 15, null).paymentDueDate, null);
  });

  test("cero días de gracia deja el pago el mismo día del corte", () => {
    const ciclo = cicloPorMes("2026-09", 15, 0);
    assert.equal(ciclo.paymentDueDate!.getTime(), ciclo.closesOn.getTime());
  });

  test("la fecha de pago cruza de año", () => {
    assert.equal(diaBogota(cicloPorMes("2026-12", 20, 20).paymentDueDate!), "2027-01-09");
  });
});

describe("invariantes", () => {
  test("los ciclos consecutivos son contiguos y no se solapan", () => {
    for (const cutoffDay of [1, 15, 28, 29, 30, 31]) {
      for (let mes = 1; mes <= 12; mes++) {
        const actual = cicloPorMes(`2026-${pad(mes)}`, cutoffDay, null);
        const siguiente = cicloPorMes(
          mes === 12 ? "2027-01" : `2026-${pad(mes + 1)}`,
          cutoffDay,
          null
        );

        assert.equal(
          actual.to.getTime(),
          siguiente.from.getTime(),
          `hueco o solape con corte ${cutoffDay} entre el mes ${mes} y el siguiente`
        );
      }
    }
  });

  test("todo día del año cae dentro de la ventana del ciclo que se le asigna", () => {
    const mediodiaDelPrimeroDeEnero = Date.UTC(2026, 0, 1, 17);

    for (const cutoffDay of [1, 15, 28, 31]) {
      for (let i = 0; i < 365; i++) {
        const fecha = new Date(mediodiaDelPrimeroDeEnero + i * MS_DIA);
        const ciclo = cicloDeFecha(fecha, cutoffDay, null);

        assert.ok(
          fecha >= ciclo.from && fecha < ciclo.to,
          `${diaBogota(fecha)} con corte ${cutoffDay} quedó fuera de ${ciclo.label}`
        );
      }
    }
  });

  test("el ciclo vigente es el que contiene a hoy", () => {
    const ahora = enBogota("2026-09-20T08:00:00");
    assert.deepEqual(cicloVigente(ahora, 15, 18), cicloDeFecha(ahora, 15, 18));
  });
});
