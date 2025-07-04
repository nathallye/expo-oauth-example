import {
  APP_SCHEME,
  BASE_URL,
  GOOGLE_AUTH_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_REDIRECT_URI,
} from "@/utils/constants";

export async function GET(request: Request) {
  if (!GOOGLE_CLIENT_ID) {
    return Response.json(
      { error: "GOOGLE_CLIENT_ID is not set" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const internalClient = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  let idpClientId: string;

  let platform;

  if (redirectUri === APP_SCHEME) {
    platform = "mobile";
  } else if (redirectUri === BASE_URL) {
    platform = "web";
  } else {
    return Response.json({ error: "Invalid redirect_uri" }, { status: 400 });
  }

  let state = platform + "|" + url.searchParams.get("state");

  if (internalClient === "google") {
    idpClientId = GOOGLE_CLIENT_ID;
  } else {
    return Response.json({ error: "Unsupported client" }, { status: 400 });
  }

  const params = new URLSearchParams({
    client_id: idpClientId,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: url.searchParams.get("scope") || "identity",
    state: state,
    prompt: "select_account",
  });

  return Response.redirect(GOOGLE_AUTH_URL + "?" + params.toString(), 302);
}
