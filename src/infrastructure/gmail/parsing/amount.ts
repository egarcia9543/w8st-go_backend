// Bancolombia usa DOS convenciones de monto según la plantilla:
//   - transferencias / pagos:  $44,000.00   (americana: coma miles, punto decimal)
//   - compras con tarjeta:     COP3.900,00  (colombiana: punto miles, coma decimal)
//
// No se puede asumir una sola. La heurística de comparar posiciones funciona
// cuando AMBOS separadores están presentes, pero se rompe en las dos direcciones
// cuando solo hay uno: "40,000" -> 40 y "3.900" -> 3.9.
//
// Por eso el caso de un solo separador se resuelve antes, por número de dígitos:
// tres dígitos después del último separador == separador de miles.
export const parseAmount = (raw: string): number => {
  const cleaned = raw.trim();
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  const hayUnSoloSeparador =
    (lastDot === -1) !== (lastComma === -1); // XOR: exactamente uno presente

  if (hayUnSoloSeparador) {
    const posicion = Math.max(lastDot, lastComma);
    const digitosDespues = cleaned.length - posicion - 1;

    // "3.900" / "40,000" -> miles. "USD3.90" / "3,5" -> decimal.
    if (digitosDespues === 3) {
      return parseFloat(cleaned.replace(/[.,]/g, ""));
    }
    return parseFloat(cleaned.replace(",", "."));
  }

  if (lastDot > lastComma) {
    // Americana: 10,000.00 -> quitar comas, el punto es decimal
    return parseFloat(cleaned.replace(/,/g, ""));
  }

  // Colombiana: 77.800,00 -> quitar puntos, la coma es decimal
  return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
};
