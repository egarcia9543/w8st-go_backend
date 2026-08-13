// Composition root de autenticación: ÚNICO lugar donde se eligen los adaptadores
// concretos. Para cambiar de proveedor (auth, sesión o conector de Gmail),
// se cambia SOLO aquí; las rutas y el middleware dependen de las interfaces.
import { UserAuthenticator } from "../../application/ports/user-authenticator";
import { SessionService } from "../../application/ports/session-service";
import { GmailConnector } from "../../application/ports/gmail-connector";
import { DbCredentialsAuthenticator } from "./db-credentials.authenticator";
import { JwtSessionService } from "./jwt-session.service";
import { GoogleGmailConnector } from "../gmail/gmail.connector";

export const userAuthenticator: UserAuthenticator = new DbCredentialsAuthenticator();
export const sessionService: SessionService = new JwtSessionService();
export const gmailConnector: GmailConnector = new GoogleGmailConnector();
