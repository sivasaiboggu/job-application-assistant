import { JobPosting } from './model';

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|ref$|ref_src$|mc_|_ga$|email_uid$)/i;

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

// Same ad reached through two share links should land on one key: strip
// tracking parameters, default ports, fragments and trailing slashes.
export function canonicalizeUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return normalizeText(rawUrl);
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const kept: string[] = [];
  const keys = [...url.searchParams.keys()].sort();
  for (const key of keys) {
    if (!TRACKING_PARAMS.test(key)) {
      kept.push(`${key.toLowerCase()}=${url.searchParams.get(key)}`);
    }
  }
  const path = url.pathname.replace(/\/+$/, '').toLowerCase();
  return `${host}${path}${kept.length ? `?${kept.join('&')}` : ''}`;
}

export function dedupeKeyFor(posting: Pick<JobPosting, 'url' | 'company' | 'title'>): string {
  return [normalizeText(posting.company), normalizeText(posting.title), canonicalizeUrl(posting.url)].join('|');
}
