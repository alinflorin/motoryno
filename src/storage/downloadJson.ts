/**
 * Web-only fallback: triggers a browser download of `text` as `fileName`
 * via a temporary anchor element. Shared by export.ts and share.ts.
 */
export function downloadJson(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
