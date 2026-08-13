import { getToken } from "next-auth/jwt";
import { fetchGoogleWithAuthRetry } from "./googleAuth";

const RECONNECT_MESSAGE = "Google 권한을 다시 연결해주세요.";

export async function getGoogleApiToken(request, session) {
  const jwtToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!session?.user) {
    return { error: "UNAUTHORIZED", status: 401 };
  }

  if (session.authError === "RefreshAccessTokenError") {
    return { error: "RefreshAccessTokenError", status: 401, message: RECONNECT_MESSAGE };
  }

  const accessToken = session.accessToken || jwtToken?.accessToken;
  if (!accessToken) {
    return { error: "NO_ACCESS_TOKEN", status: 401, message: RECONNECT_MESSAGE };
  }

  return {
    token: {
      accessToken,
      accessTokenExpires: session.expiresAt || jwtToken?.accessTokenExpires,
      refreshToken: jwtToken?.refreshToken,
      scope: session.scope || jwtToken?.scope,
    },
  };
}

export async function fetchGoogleApi(request, session, url, options = {}) {
  const auth = await getGoogleApiToken(request, session);
  if (auth.error) return { ...auth, response: null };

  const result = await fetchGoogleWithAuthRetry(url, options, auth.token);
  if (result.authError === "RefreshAccessTokenError") {
    return {
      response: result.response,
      error: "RefreshAccessTokenError",
      status: 401,
      message: RECONNECT_MESSAGE,
      retried: result.retried,
    };
  }

  return result;
}

export function getGoogleReconnectMessage() {
  return RECONNECT_MESSAGE;
}
