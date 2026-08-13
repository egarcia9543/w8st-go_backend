const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&aacute;": "á",
  "&eacute;": "é",
  "&iacute;": "í",
  "&oacute;": "ó",
  "&uacute;": "ú",
  "&ntilde;": "ñ",
  "&Ntilde;": "Ñ",
};

// Los tags se reemplazan por ESPACIO, no por cadena vacía.
// Borrarlos sin separador fusiona palabras entre bloques:
//   "...Estamos cerca</td><td>Controla tu dinero..."
//   -> "...Estamos cercaControla tu dinero..."
// Las reglas actuales sobreviven porque están ancladas a una frase contenida en
// un solo bloque, pero cualquier captura (.+?) cerca de un borde se corrompe.
export const stripHtml = (html: string): string => {
  let texto = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");

  for (const [entidad, caracter] of Object.entries(ENTIDADES)) {
    texto = texto.split(entidad).join(caracter);
  }

  // Entidades numéricas (&#243; etc.)
  texto = texto.replace(/&#(\d+);/g, (_, code: string) =>
    String.fromCharCode(Number(code))
  );

  return texto.replace(/\s+/g, " ").trim();
};

const decodeBase64 = (data: string): string =>
  Buffer.from(data, "base64url").toString("utf-8");

type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
};

// Recorre el árbol MIME completo recogiendo las partes de un tipo dado.
// La versión anterior solo miraba payload.parts (un nivel). Bancolombia envía
// multipart/related conteniendo multipart/alternative, así que el text/plain
// está un nivel más abajo: devolvía "" y el correo se descartaba sin evaluar
// un solo regex.
const recolectarPartes = (part: GmailPart, mimeType: string): string[] => {
  const encontradas: string[] = [];

  if (part.mimeType === mimeType && part.body?.data) {
    encontradas.push(decodeBase64(part.body.data));
  }

  for (const hija of part.parts ?? []) {
    encontradas.push(...recolectarPartes(hija, mimeType));
  }

  return encontradas;
};

export const extractBody = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const raiz = payload as GmailPart;

  const planas = recolectarPartes(raiz, "text/plain");
  if (planas.length > 0) {
    const texto = planas.join(" ").replace(/\s+/g, " ").trim();
    if (texto) return texto;
  }

  const htmls = recolectarPartes(raiz, "text/html");
  if (htmls.length > 0) {
    const texto = stripHtml(htmls.join(" "));
    if (texto) return texto;
  }

  // Correo de una sola parte: el cuerpo cuelga directo de la raíz sin mimeType
  // que coincida con los anteriores.
  if (raiz.body?.data) {
    const crudo = decodeBase64(raiz.body.data);
    return crudo.includes("<") ? stripHtml(crudo) : crudo.replace(/\s+/g, " ").trim();
  }

  return "";
};
