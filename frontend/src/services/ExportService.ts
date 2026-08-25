import { ApiError, AUTH_UNAUTHORIZED_EVENT } from '../utils/api';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api';

export type ExportDataset = 'properties' | 'buyers' | 'transactions' | 'analytics';
export type ExportFormat = 'csv' | 'pdf';

function clearSession() {
  localStorage.removeItem('terraguide_token');
  localStorage.removeItem('terraguide_user');
}

/** Pulls the filename out of a Content-Disposition header, falling back to a sensible default. */
function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = header.match(/filename="?([^"]+)"?/);
  return match ? match[1] : fallback;
}

/**
 * Downloads a binary export response (CSV/PDF/ZIP) and triggers a browser
 * save via a temporary anchor element. Separate from apiRequest() because
 * that helper always parses the response as JSON, which doesn't work for
 * file downloads.
 */
async function downloadBlob(endpoint: string, fallbackFilename: string) {
  const token = localStorage.getItem('terraguide_token');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }

    let message = 'Export failed';
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      // Response wasn't JSON — keep the generic message.
    }
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const filename = filenameFromContentDisposition(
    response.headers.get('Content-Disposition'),
    fallbackFilename
  );

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportDataset(dataset: ExportDataset, format: ExportFormat) {
  return downloadBlob(`/export/${dataset}?format=${format}`, `TerraGuide_${dataset}.${format}`);
}

export async function exportAllDataZip() {
  return downloadBlob('/export/all/zip', 'TerraGuide_AllData.zip');
}
