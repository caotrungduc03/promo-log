export interface Env {
  GOOGLE_CLIENT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  GOOGLE_SHEET_ID: string;
  SYNC_SECRET?: string;
  SHEET_NAME?: string;
  ALLOWED_ORIGIN?: string;
}

interface DayLogPayload {
  date: string;
  pomodoroMinutes?: number;
  sessions: {
    morning: number[];
    afternoon: number[];
    evening: number[];
  };
  updatedAt: string;
}

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const HEADER_ROW = [
  'date',
  'morning',
  'afternoon',
  'evening',
  'total_minutes',
  'pomodoro_count',
  'updated_at',
];

let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

function buildCorsHeaders(request: Request, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN?.trim() || '*';
  const requestOrigin = request.headers.get('Origin') || '';
  const origin =
    allowed === '*'
      ? '*'
      : allowed
            .split(',')
            .map((item) => item.trim())
            .includes(requestOrigin)
        ? requestOrigin
        : allowed.split(',')[0].trim();

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });
}

function toBase64Url(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getGoogleAccessToken(env: Env): Promise<string> {
  const nowMs = Date.now();
  if (cachedAccessToken && nowMs < cachedAccessToken.expiresAtMs - 60_000) {
    return cachedAccessToken.token;
  }

  const nowSec = Math.floor(nowMs / 1000);
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = toBase64Url(
    JSON.stringify({
      iss: env.GOOGLE_CLIENT_EMAIL,
      scope: SHEETS_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );

  const signingInput = `${header}.${claimSet}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${toBase64Url(signature)}`;

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google OAuth error (${tokenRes.status}): ${text}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    expires_in?: number;
  };
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAtMs: nowMs + (tokenData.expires_in ?? 3600) * 1000,
  };
  return cachedAccessToken.token;
}

async function sheetsRequest<T>(
  env: Env,
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(env.GOOGLE_SHEET_ID)}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Sheets API error (${res.status}): ${errText}`);
  }
  return (await res.json()) as T;
}

function formatDayLogRow(log: DayLogPayload): (string | number)[] {
  const morning = log.sessions.morning ?? [];
  const afternoon = log.sessions.afternoon ?? [];
  const evening = log.sessions.evening ?? [];
  const all = [...morning, ...afternoon, ...evening];
  const totalMinutes = all.reduce((sum, m) => sum + m, 0);

  return [
    log.date,
    JSON.stringify(morning),
    JSON.stringify(afternoon),
    JSON.stringify(evening),
    totalMinutes,
    all.length,
    log.updatedAt,
  ];
}

function parseSessionArray(raw: unknown): number[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((n): n is number => typeof n === 'number' && n > 0)
      : [];
  } catch {
    return [];
  }
}

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

async function handlePostSync(
  request: Request,
  env: Env,
): Promise<{ ok: true; updated: number; appended: number; total: number }> {
  const body = (await request.json()) as {
    logs?: Record<string, DayLogPayload>;
  };
  if (!body?.logs || typeof body.logs !== 'object') {
    throw new Error('Request body must contain a "logs" object.');
  }

  const entries = Object.values(body.logs)
    .filter((log): log is DayLogPayload => Boolean(log?.date && log?.sessions))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length === 0) {
    return { ok: true, updated: 0, appended: 0, total: 0 };
  }

  const sheetRef = quoteSheetName(env.SHEET_NAME?.trim() || 'Sheet1');
  const accessToken = await getGoogleAccessToken(env);

  const existing = await sheetsRequest<{ values?: string[][] }>(
    env,
    accessToken,
    `/values/${encodeURIComponent(`${sheetRef}!A:A`)}`,
  );

  const existingRows = existing.values ?? [];
  const dateToRow = new Map<string, number>();
  existingRows.forEach((row, idx) => {
    const cell = row[0]?.trim();
    if (cell && cell !== 'date') {
      dateToRow.set(cell, idx + 1);
    }
  });

  const updates: { range: string; values: (string | number)[][] }[] = [];
  const appends: (string | number)[][] = [];

  if (existingRows.length === 0) {
    appends.push(HEADER_ROW);
  }

  for (const log of entries) {
    const rowValues = formatDayLogRow(log);
    const existingRowNumber = dateToRow.get(log.date);
    if (existingRowNumber) {
      updates.push({
        range: `${sheetRef}!A${existingRowNumber}:G${existingRowNumber}`,
        values: [rowValues],
      });
    } else {
      appends.push(rowValues);
    }
  }

  if (updates.length > 0) {
    await sheetsRequest(env, accessToken, '/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updates,
      }),
    });
  }

  if (appends.length > 0) {
    await sheetsRequest(
      env,
      accessToken,
      `/values/${encodeURIComponent(`${sheetRef}!A:G`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        body: JSON.stringify({ values: appends }),
      },
    );
  }

  const appendedLogsCount =
    existingRows.length === 0 ? Math.max(0, appends.length - 1) : appends.length;

  return {
    ok: true,
    updated: updates.length,
    appended: appendedLogsCount,
    total: entries.length,
  };
}

async function handleGetSync(
  env: Env,
): Promise<{ ok: true; logs: Record<string, DayLogPayload> }> {
  const sheetRef = quoteSheetName(env.SHEET_NAME?.trim() || 'Sheet1');
  const accessToken = await getGoogleAccessToken(env);
  const res = await sheetsRequest<{ values?: string[][] }>(
    env,
    accessToken,
    `/values/${encodeURIComponent(`${sheetRef}!A:G`)}`,
  );

  const logs: Record<string, DayLogPayload> = {};
  for (const row of res.values ?? []) {
    const date = row[0]?.trim();
    if (!date || date === 'date' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      continue;
    }
    logs[date] = {
      date,
      sessions: {
        morning: parseSessionArray(row[1]),
        afternoon: parseSessionArray(row[2]),
        evening: parseSessionArray(row[3]),
      },
      updatedAt: row[6]?.trim() || new Date().toISOString(),
    };
  }

  return { ok: true, logs };
}

function isAuthorized(request: Request, env: Env): boolean {
  const expected = env.SYNC_SECRET?.trim();
  if (!expected) return true;
  const auth = request.headers.get('Authorization') ?? '';
  return auth === `Bearer ${expected}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!isAuthorized(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    if (
      !env.GOOGLE_CLIENT_EMAIL ||
      !env.GOOGLE_PRIVATE_KEY ||
      !env.GOOGLE_SHEET_ID
    ) {
      return jsonResponse(
        { error: 'Worker is missing Google Sheets secrets configuration.' },
        500,
        corsHeaders,
      );
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === '/sync' && request.method === 'POST') {
        const result = await handlePostSync(request, env);
        return jsonResponse(result, 200, corsHeaders);
      }

      if (url.pathname === '/sync' && request.method === 'GET') {
        const result = await handleGetSync(env);
        return jsonResponse(result, 200, corsHeaders);
      }

      if (url.pathname === '/health') {
        return jsonResponse({ ok: true }, 200, corsHeaders);
      }

      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected worker error';
      return jsonResponse({ error: message }, 500, corsHeaders);
    }
  },
};
