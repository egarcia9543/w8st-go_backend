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
    // Códigos de un solo uso para entrar a la sucursal virtual. Llegan del mismo
    // remitente que las alertas de movimientos, así que hay que descartarlos
    // explícitamente. Nunca guardamos su cuerpo.
    nombre: "codigo-seguridad",
    patron: /c[oó]digo\s+de\s+seguridad|No\s+lo\s+compartas\s+con\s+nadie/i,
  },
];

/// Devuelve el nombre del patrón que hace ignorable el correo, o null.
export const motivoParaIgnorar = (body: string): string | null =>
  IGNORABLES.find((i) => i.patron.test(body))?.nombre ?? null;
