import type { SettingsResponse, ThemeSettings } from './types';

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;

  let message = 'Request failed';
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) message = payload.error;
  } catch {
    // Keep fallback error message.
  }

  throw new Error(message);
}

export async function fetchSettings(): Promise<SettingsResponse> {
  const response = await fetch('/api/settings', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return parseResponse<SettingsResponse>(response);
}

export async function saveSettings(settings: ThemeSettings): Promise<void> {
  const response = await fetch('/api/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ settings }),
  });

  await parseResponse<{ ok: true }>(response);
}
