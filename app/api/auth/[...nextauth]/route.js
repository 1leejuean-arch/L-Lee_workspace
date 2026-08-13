import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isAccessTokenFresh, refreshGoogleAccessToken } from "../../../../lib/googleAuth";

const GOOGLE_AUTH_SCOPE = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive",
].join(" ");

const googleAuthorizationParams = {
  // Full Drive access is required because the workspace can delete files it lists.
  scope: GOOGLE_AUTH_SCOPE,
  access_type: "offline",
  prompt: "consent",
  include_granted_scopes: "true",
  response_type: "code",
};

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: googleAuthorizationParams,
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined;
        token.scope = account.scope || GOOGLE_AUTH_SCOPE;
        token.error = undefined;
        token.authError = undefined;
        return token;
      }

      if (isAccessTokenFresh(token.accessTokenExpires)) {
        return token;
      }

      return refreshGoogleAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.expiresAt = token.accessTokenExpires;
      session.scope = token.scope;
      // Keep the refresh token server-side in the encrypted JWT cookie.
      session.hasRefreshToken = Boolean(token.refreshToken);
      session.error = token.error;
      session.authError = token.authError || token.error;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
