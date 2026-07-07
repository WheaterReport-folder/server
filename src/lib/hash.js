import { createHash } from 'node:crypto';

export function contentHash(event) {
  const raw = [event.title, event.location, event.startDate, event.endDate]
    .map(v => v ?? '')
    .join('|');
  return createHash('sha256').update(raw).digest('hex');
}
