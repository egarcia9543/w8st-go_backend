// Correos del banco que NO son movimientos de dinero.
//
// Sin esta lista terminan en UnparsedEmail marcados como NO_MATCH, mezclados
// con las plantillas que sí faltan por implementar. Eso vuelve inútil la bandeja
// de diagnóstico: si el ruido y la señal se ven igual, dejas de mirarla.
//
// Ojo: ignorar es una decisión explícita, no un descarte silencioso. Si un
// patrón de aquí resulta estar tapando movimientos reales, quítalo y volverán
// a aparecer como NO_MATCH.
export const IGNORABLES: { nombre: string; patron: RegExp }[] = [
  {
    nombre: "inscripcion-facturas",
    patron: /Inscribiste\s+las\s+facturas\b/i,
  },
  {
    nombre: "novedad-factura-inscrita",
    patron: /La\s+factura\s+que\s+inscribiste\b/i,
  },
  {
    nombre: "marketing",
    patron: /Tenemos\s+novedades\b/i,
  },
  {
    // Códigos de un solo uso para entrar a la sucursal virtual.
    //
    // El patrón apunta a la frase que SOLO aparece en ese correo. Un patrón
    // laxo como /código de seguridad/ matchea el pie de seguridad que traen casi
    // todos los correos del banco ("Cuida tu usuario, clave, número de tarjeta
    // de crédito, fecha de vencimiento y código de seguridad").
    nombre: "codigo-seguridad",
    patron: /Hemos\s+generado\s+para\s+ti\s+este\s+c[oó]digo|Estas\s+intentando\s+ingresar\s+a\s+la\s+Sucursal\s+Virtual/i,
  },
];

/// Devuelve el nombre del patrón que hace ignorable el correo, o null.
export const motivoParaIgnorar = (body: string): string | null =>
  IGNORABLES.find((i) => i.patron.test(body))?.nombre ?? null;
