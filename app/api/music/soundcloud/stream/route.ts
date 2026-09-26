import { NextRequest, NextResponse } from "next/server";

const API = "https://api.soundcloud.com";
const TOKEN = "https://secure.soundcloud.com/oauth/token";
let cached: { accessToken: string; refreshToken: string | null; expiresAt: number } | null = null;

async function token() {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("SoundCloud API credentials are not configured.");
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;
  if (cached?.refreshToken) {
    const refresh = await fetch(TOKEN, { method: "POST", headers: { Accept: "application/json; charset=utf-8", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: cached.refreshToken }).toString(), cache: "no-store" });
    if (refresh.ok) {
      const data = await refresh.json();
      if (typeof data.access_token === "string") {
        cached = { accessToken: data.access_token, refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : cached.refreshToken, expiresAt: Date.now() + Math.max(60, Number(data.expires_in ?? 3600)) * 1000 };
        return cached.accessToken;
      }
    }
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(TOKEN, { method: "POST", headers: { Accept: "application/json; charset=utf-8", "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` }, body: new URLSearchParams({ grant_type: "client_credentials" }).toString(), cache: "no-store" });
  if (!response.ok) throw new Error(`SoundCloud token request failed with ${response.status}.`);
  const data = await response.json();
  if (typeof data.access_token !== "string") throw new Error("SoundCloud token response did not contain an access token.");
  cached = { accessToken: data.access_token, refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : null, expiresAt: Date.now() + Math.max(60, Number(data.expires_in ?? 3600)) * 1000 };
  return cached.accessToken;
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid SoundCloud track id." }, { status: 400 });
  try {
    const accessToken = await token();
    const response = await fetch(`${API}/tracks/${encodeURIComponent(id)}/streams`, { headers: { Accept: "application/json; charset=utf-8", Authorization: `OAuth ${accessToken}` }, cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: response.status === 403 ? "This SoundCloud track is not available for external playback." : `SoundCloud stream request failed with ${response.status}.` }, { status: response.status === 429 ? 429 : 502 });
    const data = await response.json();
    const transcodings = Array.isArray(data.transcodings) ? data.transcodings : [];
    const preferred = transcodings.find((item: any) => item.format?.protocol === "hls" && item.format?.mime_type === "audio/aac") ?? transcodings.find((item: any) => item.format?.protocol === "hls") ?? transcodings.find((item: any) => item.format?.protocol === "progressive" && Boolean(item.url));
    if (!preferred?.url) return NextResponse.json({ error: "No compatible full-length SoundCloud stream was provided." }, { status: 404 });
    return NextResponse.redirect(preferred.url, 307);
  } catch (error) {
    console.error("SoundCloud stream error:", error);
    return NextResponse.json({ error: "Unable to resolve the SoundCloud stream." }, { status: 500 });
  }
}
