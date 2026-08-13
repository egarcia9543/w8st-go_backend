import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseAmount } from "../parsing/amount";
import { parseDate } from "../parsing/date";
import { stripHtml, extractBody } from "../parsing/html";
import { mesBogota } from "../../date/bogota";

describe("parseAmount", () => {
  // Bancolombia usa las DOS convenciones según la plantilla.
  test("convención americana (transferencias y pagos)", () => {
    assert.equal(parseAmount("44,000.00"), 44000);
    assert.equal(parseAmount("2,088,000.00"), 2088000);
    assert.equal(parseAmount("40,000.00"), 40000);
  });

  test("convención colombiana (compras con tarjeta)", () => {
    assert.equal(parseAmount("3.900,00"), 3900);
    assert.equal(parseAmount("77.800,00"), 77800);
    assert.equal(parseAmount("1.234.567,89"), 1234567.89);
  });

  // El bug: con un solo separador la heurística de posiciones se rompía en
  // ambas direcciones. "40,000" daba 40 y "3.900" daba 3.9.
  test("montos SIN decimales: el separador es de miles", () => {
    assert.equal(parseAmount("40,000"), 40000);
    assert.equal(parseAmount("3.900"), 3900);
    assert.equal(parseAmount("1,500"), 1500);
  });

  test("decimales legítimos de dos dígitos siguen siendo decimales", () => {
    assert.equal(parseAmount("3.90"), 3.9);
    assert.equal(parseAmount("3,90"), 3.9);
  });

  test("sin separadores", () => {
    assert.equal(parseAmount("3900"), 3900);
  });
});

describe("parseDate", () => {
  test("hora sin segundos", () => {
    assert.equal(parseDate("12/08/26", "15:58").toISOString(), "2026-08-12T20:58:00.000Z");
  });

  // Producía "T10:37:27:00" -> Invalid Date.
  test("hora CON segundos", () => {
    assert.equal(parseDate("12/08/2026", "10:37:27").toISOString(), "2026-08-12T15:37:27.000Z");
  });

  test("año de 2 y de 4 dígitos dan lo mismo", () => {
    assert.equal(
      parseDate("27/07/26", "16:29").toISOString(),
      parseDate("27/07/2026", "16:29").toISOString()
    );
  });

  // Sin offset explícito el resultado dependía de la zona del proceso:
  // distinto en tu máquina (UTC-5) que en Vercel (UTC).
  test("fija el offset de Bogotá sin importar la zona del proceso", () => {
    assert.equal(parseDate("05/08/2026", "09:22").toISOString(), "2026-08-05T14:22:00.000Z");
  });
});

describe("mesBogota", () => {
  // El caso que rompía el resumen: 31 de julio 8pm Bogotá se contaba en agosto.
  test("una compra del 31 a las 8pm cuenta en su mes, no en el siguiente", () => {
    assert.equal(mesBogota(parseDate("31/07/2026", "20:00")), "2026-07");
  });

  test("el primero a las 00:01 cuenta en su mes", () => {
    assert.equal(mesBogota(parseDate("01/08/2026", "00:01")), "2026-08");
  });
});

describe("stripHtml", () => {
  // Reemplazar tags por "" fusiona palabras entre bloques.
  test("separa bloques con espacio en vez de fusionar palabras", () => {
    const html = "<td>Estamos cerca</td><td>Controla tu dinero</td>";
    assert.equal(stripHtml(html), "Estamos cerca Controla tu dinero");
  });

  test("descarta script y style con su contenido", () => {
    const html = "<style>.x{color:red}</style><p>Hola</p><script>var a=1</script>";
    assert.equal(stripHtml(html), "Hola");
  });

  test("decodifica entidades", () => {
    assert.equal(stripHtml("<p>Cr&eacute;dito &amp; d&eacute;bito</p>"), "Crédito & débito");
  });

  test("conserva el texto de un enlace y descarta el href", () => {
    assert.equal(stripHtml('<a href="http://x.com/track?id=1">APPLE.COM/BILL</a>'), "APPLE.COM/BILL");
  });
});

describe("extractBody", () => {
  const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64url");

  test("recorre partes anidadas (el bug que descartaba correos)", () => {
    const payload = {
      mimeType: "multipart/related",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [{ mimeType: "text/plain", body: { data: b64("hola mundo") } }],
        },
      ],
    };
    assert.equal(extractBody(payload), "hola mundo");
  });

  test("prefiere text/plain sobre text/html", () => {
    const payload = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/html", body: { data: b64("<p>version html</p>") } },
        { mimeType: "text/plain", body: { data: b64("version plana") } },
      ],
    };
    assert.equal(extractBody(payload), "version plana");
  });

  test("cuerpo directo en la raíz", () => {
    assert.equal(extractBody({ body: { data: b64("suelto") } }), "suelto");
  });

  test("payload nulo no revienta", () => {
    assert.equal(extractBody(null), "");
    assert.equal(extractBody(undefined), "");
  });
});
