/**
 * SmartVenue — Security & Validation
 * Input validation, sanitization, and role-based access control.
 */

import { UserRole } from '../types.js';

// ── Input Validation ────────────────────────────────────────────────
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>"'&]/g, (ch) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' };
    return map[ch] || ch;
  }).trim().slice(0, 500);
}

export function validateNumber(input: unknown, min: number, max: number): number {
  const n = typeof input === 'number' ? input : parseFloat(String(input));
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function validateZoneId(id: unknown): string | null {
  const s = sanitizeString(id);
  return /^[a-zA-Z0-9_-]{1,50}$/.test(s) ? s : null;
}

export function validateLatLng(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = validateNumber(lat, -90, 90);
  const ln = validateNumber(lng, -180, 180);
  if (la === -90 && ln === -180) return null;
  return { lat: la, lng: ln };
}

// ── Role-Based Access Control ───────────────────────────────────────
interface RolePermissions {
  canViewHeatmap: boolean;
  canViewQueues: boolean;
  canTriggerEmergency: boolean;
  canResolveIncidents: boolean;
  canModifyZones: boolean;
  canViewAllIncidents: boolean;
  canAccessSimulation: boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  attendee: {
    canViewHeatmap: true, canViewQueues: true, canTriggerEmergency: false,
    canResolveIncidents: false, canModifyZones: false, canViewAllIncidents: false,
    canAccessSimulation: false,
  },
  operator: {
    canViewHeatmap: true, canViewQueues: true, canTriggerEmergency: true,
    canResolveIncidents: true, canModifyZones: true, canViewAllIncidents: true,
    canAccessSimulation: true,
  },
};

export function getPermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.attendee;
}

export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  return getPermissions(role)[permission];
}

export function validateRole(input: unknown): UserRole {
  const s = String(input).toLowerCase().trim();
  return s === 'operator' ? 'operator' : 'attendee';
}

// ── Firestore Document Sanitization ─────────────────────────────────
export function sanitizeFirestoreDoc<T extends Record<string, unknown>>(doc: T): T {
  const sanitized = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(doc)) {
    const cleanKey = sanitizeString(key);
    if (!cleanKey) continue;
    if (typeof value === 'string') sanitized[cleanKey] = sanitizeString(value);
    else if (typeof value === 'number') sanitized[cleanKey] = validateNumber(value, -1e9, 1e9);
    else if (typeof value === 'boolean') sanitized[cleanKey] = value;
    else if (value === null || value === undefined) sanitized[cleanKey] = null;
    else sanitized[cleanKey] = value;
  }
  return sanitized as T;
}

// ── Rate Limiting (simple in-memory) ────────────────────────────────
const actionTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30;

export function checkRateLimit(actionKey: string): boolean {
  const now = Date.now();
  const timestamps = actionTimestamps.get(actionKey) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  actionTimestamps.set(actionKey, recent);
  return true;
}
