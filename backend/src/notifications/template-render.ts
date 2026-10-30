import { VALUE_LABELS } from './default-templates';
import { NotificationLocale } from './notification.constants';

export interface RenderOptions {
  locale: NotificationLocale;
  /** IANA time zone for `*_at` variables (the organisation's, default Asia/Dhaka). */
  timeZone: string;
  /** Escape variables for HTML (email bodies). */
  html: boolean;
}

const VARIABLE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
const INTL_LOCALE: Record<NotificationLocale, string> = { bn: 'bn-BD', en: 'en-GB' };

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** One variable as text: dates (`*_at`) in the recipient's language and zone, codes by label. */
export function formatVariable(key: string, value: unknown, options: Omit<RenderOptions, 'html'>): string {
  if (value === null || value === undefined) return '';
  if (key.endsWith('_at')) {
    const date = new Date(value as string);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(INTL_LOCALE[options.locale], {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: options.timeZone,
      }).format(date);
    }
  }
  const text = String(value);
  return VALUE_LABELS[options.locale][text] ?? text;
}

/** Replaces `{{name}}` with the variable (empty when missing). */
export function renderTemplate(template: string, variables: Record<string, unknown>, options: RenderOptions): string {
  return template.replace(VARIABLE, (_match, key: string) => {
    const text = formatVariable(key, variables[key], options);
    return options.html ? escapeHtml(text) : text;
  });
}

/** The standard email layout around a template body. */
export function wrapEmailHtml(body: string, locale: NotificationLocale): string {
  return `<!doctype html><html lang="${locale}"><body style="margin:0;padding:24px;background:#F6F7F6;">
<style>
  .card{font-family:Arial,'Noto Sans Bengali',sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;color:#232A25;line-height:1.5}
  .card h2{margin-top:0}
  .card .muted{color:#747775;font-size:13px;word-break:break-all}
  .card .code{font-size:28px;letter-spacing:6px;font-weight:700;color:#49734F}
  .card .button{background:#49734F;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block}
</style>
<div class="card">${body}</div>
</body></html>`;
}
