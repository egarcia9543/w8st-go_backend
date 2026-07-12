const decodeBase64 = (data: string): string =>
  Buffer.from(data, "base64url").toString("utf-8");

const extractBody = (payload: any): string => {
  if (payload.body?.data) return decodeBase64(payload.body.data);

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data)
        return decodeBase64(part.body.data);
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data)
        return decodeBase64(part.body.data);
    }
  }

  return "";
};

const parseAmount = (raw: string): number => {
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");

  if (lastDot > lastComma) {
    // Formato americano: 10,000.00 → quitar comas, el punto es decimal
    return parseFloat(raw.replace(/,/g, ""));
  }
  // Formato colombiano: 77.800,00 → quitar puntos, la coma es decimal
  return parseFloat(raw.replace(/\./g, "").replace(",", "."));
};

const parseDate = (dateStr: string, timeStr: string): Date => {
  const [day, month, year] = dateStr.split("/");
  const fullYear = year.length === 2 ? `20${year}` : year;
  return new Date(`${fullYear}-${month}-${day}T${timeStr}:00`);
};

export type ParsedTransaction = {
  type: string;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  merchant: string | null;
  cardLast4: string | null;
  channel: string | null;
  recipientName: string | null;
  recipientKey: string | null;
  transactionDate: Date;
};

export const parseEmail = (payload: any): ParsedTransaction | null => {
  const body = extractBody(payload);
  if (!body) return null;

  const purchaseRegex =
    /Compraste\s+(COP|USD|\$)([\d.,]+)\s+en\s+(.+?)\s+con\s+tu\s+T\.(Cred|Deb)\s+\*(\d{4}),?\s+el\s+(\d{2}\/\d{2}\/\d{2,4})\s+a\s+las\s+(\d{2}:\d{2})/i;

  const purchaseMatch = body.match(purchaseRegex);
  if (purchaseMatch) {
    const [, currencyRaw, amountRaw, merchant, cardType, last4, dateStr, timeStr] = purchaseMatch;
    return {
      type: "compra",
      amount: parseAmount(amountRaw),
      currency: currencyRaw === "$" ? "COP" : currencyRaw,
      paymentMethod: cardType.toLowerCase() === "cred" ? "tarjeta_credito" : "tarjeta_debito",
      merchant: merchant.trim(),
      cardLast4: last4,
      channel: null,
      recipientName: null,
      recipientKey: null,
      transactionDate: parseDate(dateStr, timeStr),
    };
  }

  const transferRegex =
    /transferiste\s+\$([\d.,]+)\s+a\s+la\s+llave\s+(\d+)\s+desde\s+tu\s+cuenta\s+\*(\d{4})\s+a\s+(.+?)\s+el\s+(\d{2}\/\d{2}\/\d{2,4})\s+a\s+las\s+(\d{2}:\d{2})/i;

  const transferMatch = body.match(transferRegex);
  if (transferMatch) {
    const [, amountRaw, recipientKey, accountLast4, recipientName, dateStr, timeStr] = transferMatch;
    return {
      type: "transferencia",
      amount: parseAmount(amountRaw),
      currency: "COP",
      paymentMethod: "cuenta",
      merchant: null,
      cardLast4: accountLast4,
      channel: body.includes("Bre-b") ? "Bre-b" : null,
      recipientName: recipientName.trim(),
      recipientKey,
      transactionDate: parseDate(dateStr, timeStr),
    };
  }

  return null;
};
