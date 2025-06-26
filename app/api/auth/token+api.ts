import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  COOKIE_OPTIONS,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  JWT_EXPIRATION_TIME,
  JWT_SECRET,
} from "@/utils/constants";
import * as jose from "jose";

export async function POST(request: Request) {
  const body = await request.formData();
  const form = body as unknown as FormData;

  const code = form.get("code") as string;
  const platform = (form.get("platform") as string) || "native";

  if (!code) {
    return new Response("Missing auth code", { status: 400 });
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();

  if (!data.id_token) {
    return new Response("Failed to retrieve ID token", { status: 400 });
  }

  // We have the id_token, now we can extract user info
  const userInfo = jose.decodeJwt(data.id_token) as object;

  const { expiration, ...userInfoWithoutExpiration } = userInfo as any;

  // User id
  const userId = (userInfo as { sub: string }).sub;

  // Current timestamp in seconds
  const currentTimestamp = Math.floor(Date.now() / 1000);

  // Create access token (short-lived)
  const accessToken = await new jose.SignJWT(userInfoWithoutExpiration)
    .setProtectedHeader({
      alg: "HS256",
    })
    .setIssuedAt(currentTimestamp)
    .setExpirationTime(JWT_EXPIRATION_TIME) // 20 seconds
    .setSubject(userId)
    .sign(new TextEncoder().encode(JWT_SECRET)); // secret key

  if (platform === "web") {
    const response = Response.json({
      success: true,
      issuedAt: currentTimestamp,
      expiresAt: currentTimestamp + COOKIE_MAX_AGE, // 20 seconds only, change this in production
    });

    // Set the access token in a http-only cookie
    response.headers.set(
      "Set-Cookie",
      `${COOKIE_NAME}=${accessToken}; Max-Age=${COOKIE_OPTIONS.maxAge};` +
        ` Path=${COOKIE_OPTIONS.path}; ` +
        `${COOKIE_OPTIONS.httpOnly ? "HttpOnly" : ""} ` +
        `${COOKIE_OPTIONS.secure ? "Secure" : ""} ` +
        `SameSite=${COOKIE_OPTIONS.sameSite}`
    ); // Set cookie for web platform

    // Return the response with the cookie set to web clients
    return response;
  }

  // For native platforms, we return the access token directly
  return Response.json({
    accessToken,
  });
}
