import { google } from "googleapis";
import getDb from "./db";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function getCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/calendar/callback";

  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }

  return { clientId, clientSecret, redirectUri };
}

export function getAuthUrl() {
  const { clientId, clientSecret, redirectUri } = getCredentials();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function handleCallback(code: string) {
  const { clientId, clientSecret, redirectUri } = getCredentials();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);

  const db = getDb();
  const upsert = db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  );
  if (tokens.refresh_token) {
    upsert.run("google_refresh_token", tokens.refresh_token);
  }
  if (tokens.access_token) {
    upsert.run("google_access_token", tokens.access_token);
  }
  if (tokens.expiry_date) {
    upsert.run("google_token_expiry", String(tokens.expiry_date));
  }

  return tokens;
}

export function getCalendarClient() {
  const { clientId, clientSecret, redirectUri } = getCredentials();
  const db = getDb();
  const getSetting = db.prepare("SELECT value FROM settings WHERE key = ?");

  const refreshToken = (getSetting.get("google_refresh_token") as { value: string } | undefined)?.value;
  const accessToken = (getSetting.get("google_access_token") as { value: string } | undefined)?.value;
  const expiry = (getSetting.get("google_token_expiry") as { value: string } | undefined)?.value;

  if (!refreshToken) {
    throw new Error("Google Calendar not connected. Please authenticate first.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken || undefined,
    expiry_date: expiry ? Number(expiry) : undefined,
  });

  // Update stored tokens when they refresh
  oauth2Client.on("tokens", (tokens) => {
    const upsert = db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
    );
    if (tokens.access_token) upsert.run("google_access_token", tokens.access_token);
    if (tokens.expiry_date) upsert.run("google_token_expiry", String(tokens.expiry_date));
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

export function isCalendarConnected(): boolean {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("google_refresh_token") as { value: string } | undefined;
    return !!row?.value;
  } catch {
    return false;
  }
}

export function getBookingSettings() {
  const db = getDb();
  const getSetting = db.prepare("SELECT value FROM settings WHERE key = ?");

  return {
    slotDuration: Number((getSetting.get("booking_slot_duration") as { value: string } | undefined)?.value || "30"),
    startHour: Number((getSetting.get("booking_start_hour") as { value: string } | undefined)?.value || "9"),
    endHour: Number((getSetting.get("booking_end_hour") as { value: string } | undefined)?.value || "17"),
    timezone: (getSetting.get("booking_timezone") as { value: string } | undefined)?.value || "Australia/Sydney",
    daysAvailable: JSON.parse((getSetting.get("booking_days") as { value: string } | undefined)?.value || "[1,2,3,4,5]") as number[],
    bufferMinutes: Number((getSetting.get("booking_buffer") as { value: string } | undefined)?.value || "10"),
    bookingName: (getSetting.get("booking_name") as { value: string } | undefined)?.value || "Sohan Domingo",
    bookingTitle: (getSetting.get("booking_title") as { value: string } | undefined)?.value || "30 Minute Meeting",
  };
}
