import { APP_SCHEME, BASE_URL } from "@/utils/constants";

export async function GET(request: Request) {
  const incomingParams = new URLSearchParams(request.url.split("?")[1]);
  const combinedPlatformState = incomingParams.get("state");

  if (!combinedPlatformState) {
    return Response.json({ error: "Invalid state parameter" }, { status: 400 });
  }

  const platform = combinedPlatformState.split("|")[0];
  const state = combinedPlatformState.split("|")[1];

  const outgoingParams = new URLSearchParams({
    code: incomingParams.get("code")?.toString() || "",
    state,
  });

  return Response.redirect(
    (platform === "mobile" ? APP_SCHEME : BASE_URL) +
      "?" +
      outgoingParams.toString(),
    302
  );
}
