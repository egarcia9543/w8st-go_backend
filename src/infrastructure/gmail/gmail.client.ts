import { google } from "googleapis";

export const createOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.REDIRECT_URI
  );
};

export const getAuthUrl = () => {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    prompt: "consent",
  });
};
