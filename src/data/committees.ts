import type { Committee } from '../types/portal';

export function getCommitteeName(committees: Committee[], id: string | null | undefined): string {
  if (!id) return 'College Administration';
  return committees.find((c) => c.id === id)?.name ?? id;
}

export function toCommitteeSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52);
  return base || `committee-${Date.now().toString(36)}`;
}
