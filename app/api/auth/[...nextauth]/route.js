import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isAccessTokenFresh, refreshGoogleAccessToken } from "../../../../lib/googleAuth";

const googleAuthorizationParams = {
  // Drive file deletion requires write access to Drive files returned by the workspace.
  scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive",
  access_type: "offline",
  include_granted_scopes: "true",
  response_type: "code",
};

if (process.env.GOOGLE_FORCE_CONSENT === "true") {
  googleAuthorizationParams.prompt = "consent";
}

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
      session.error = token.error;
      session.authError = token.authError || token.error;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
