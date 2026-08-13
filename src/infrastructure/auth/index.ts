// Composition root de autenticación: ÚNICO lugar donde se eligen los adaptadores
// concretos. Para cambiar de proveedor (auth, sesión o Google), se cambia SOLO
// aquí; las rutas y el middleware dependen de las interfaces.
import { UserAuthenticator } from "../../application/ports/user-authenticator";
import { SessionService } from "../../application/ports/session-service";
import { GoogleAuthProvider } from "../../application/ports/google-auth";
import { DbCredentialsAuthenticator } from "./db-credentials.authenticator";
import { JwtSessionService } from "./jwt-session.service";
import { GoogleOAuthProvider } from "../google/google-auth.provider";

export const userAuthenticator: UserAuthenticator = new DbCredentialsAuthenticator();
export const sessionService: SessionService = new JwtSessionService();
export const googleAuthProvider: GoogleAuthProvider = new GoogleOAuthProvider();
