const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_REFRESH_MARGIN_SECONDS = 60;

const refreshRequests = new Map();

function getTokenExpiryMs(tokenResponse) {
  const expiresIn = Number(tokenResponse.expires_in || 3600);
  return Date.now() + expiresIn * 1000;
}

function getGoogleClientConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

function getTokenErrorCode(data) {
  if (!data || typeof data !== "object") return "unknown_error";
  return data.error || data.error_description || "unknown_error";
}

export function isAccessTokenFresh(expiresAt) {
  if (!expiresAt) return false;
  return Date.now() < Number(expiresAt) - TOKEN_REFRESH_MARGIN_SECONDS * 1000;
}

export async function refreshGoogleAccessToken(token) {
  if (!token?.refreshToken) {
    return {
      ...token,
      error: "RefreshAccessTokenError",
      authError: "RefreshAccessTokenError",
    };
  }

  const requestKey = token.refreshToken;
  if (refreshRequests.has(requestKey)) {
    return refreshRequests.get(requestKey);
  }

  const refreshPromise = refreshGoogleAccessTokenOnce(token).finally(() => {
    refreshRequests.delete(requestKey);
  });
  refreshRequests.set(requestKey, refreshPromise);
  return refreshPromise;
}

async function refreshGoogleAccessTokenOnce(token) {
  const { clientId, clientSecret } = getGoogleClientConfig();
  if (!clientId || !clientSecret) {
    return {
      ...token,
      error: "RefreshAccessTokenError",
      authError: "RefreshAccessTokenError",
    };
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
      cache: "no-store",
    });

    const refreshedTokens = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Google access token refresh failed", {
        status: response.status,
        error: getTokenErrorCode(refreshedTokens),
      });

      return {
        ...token,
        error: "RefreshAccessTokenError",
        authError: "RefreshAccessTokenError",
      };
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: getTokenExpiryMs(refreshedTokens),
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      scope: refreshedTokens.scope ?? token.scope,
      error: undefined,
      authError: undefined,
    };
  } catch (error) {
    console.error("Google access token refresh failed", {
      status: "network_error",
      error: error?.name || "unknown_error",
    });

    return {
      ...token,
      error: "RefreshAccessTokenError",
      authError: "RefreshAccessTokenError",
    };
  }
}

export async function fetchGoogleWithAuthRetry(url, options = {}, token) {
  const firstAccessToken = token?.accessToken;
  if (!firstAccessToken) {
    return {
      response: null,
      token,
      authError: "RefreshAccessTokenError",
      retried: false,
    };
  }

  const firstResponse = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${firstAccessToken}`,
    },
  });

  if (firstResponse.status !== 401 || !token?.refreshToken) {
    return { response: firstResponse, token, retried: false };
  }

  const refreshedToken = await refreshGoogleAccessToken({
    ...token,
    accessTokenExpires: 0,
  });

  if (refreshedToken?.error || !refreshedToken?.accessToken) {
    return {
      response: firstResponse,
      token: refreshedToken,
      authError: "RefreshAccessTokenError",
      retried: false,
    };
  }

  const retryResponse = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${refreshedToken.accessToken}`,
    },
  });

  return {
    response: retryResponse,
    token: refreshedToken,
    retried: true,
  };
}
