// Puerto (interfaz) del conector de Gmail. YA NO ES LOGIN: es la autorización
// OAuth con Google que /sync necesita para leer los correos de Bancolombia.
// Se ejecuta como una acción aparte, protegida (el owner ya inició sesión).
export interface GmailConnector {
  /** URL de autorización de Google a la que redirigir el navegador. */
  getAuthUrl(): string;

  /**
   * Procesa el callback de Google y persiste los tokens de acceso a Gmail.
   * Lanza si el intercambio falla.
   */
  handleCallback(params: Record<string, string | undefined>): Promise<void>;
}
