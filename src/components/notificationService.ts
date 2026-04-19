/**
 * SmartVenue — Notification Service
 * Hooks into the browser's Notification API to provide real-time OS-level 
 * push notifications for critical venue alerts (emergencies, closures, spikes).
 */

import { Incident } from '../types.js';

let permissionGranted = false;
const notifiedIncidents = new Set<string>();

// ── Initialize Notification API ──────────────────────────────────────
export async function initNotifications(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[Notifications] Browser does not support system notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    permissionGranted = permission === 'granted';
    return permissionGranted;
  }

  return false;
}

// ── Send Push Notification ───────────────────────────────────────────
export function sendPushNotification(title: string, options?: NotificationOptions): void {
  if (!permissionGranted) return;

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico', // fallback icon
      badge: '/favicon.ico',
      ...options,
    });

    // Auto-close after a few seconds unless it's a critical emergency
    if (!options?.requireInteraction) {
      setTimeout(() => notification.close(), 6000);
    }
  } catch (err) {
    console.error('[Notifications] Failed to send push notification', err);
  }
}

// ── Notify on New Incidents ──────────────────────────────────────────
export function notifyNewIncidents(incidents: Incident[]): void {
  const activeIncidents = incidents.filter(i => i.active);

  for (const incident of activeIncidents) {
    if (!notifiedIncidents.has(incident.incidentId)) {
      notifiedIncidents.add(incident.incidentId);

      // Determine severity icon and interaction
      let icon = '⚠️';
      let requireInteraction = false;
      let title = `Venue Alert: ${incident.zoneName}`;

      if (incident.severity === 'critical' || incident.type === 'emergency') {
        icon = '🚨';
        requireInteraction = true;
        title = `CRITICAL EMERGENCY: ${incident.zoneName}`;
      } else if (incident.severity === 'high' || incident.type === 'zone_closure') {
        icon = '🚫';
        title = `Zone Closed: ${incident.zoneName}`;
      } else if (incident.type === 'crowd_spike') {
        icon = '📈';
        title = `Crowd Surge: ${incident.zoneName}`;
      }

      sendPushNotification(title, {
        body: incident.description,
        requireInteraction,
        tag: incident.incidentId, // prevents duplicate stacked notifications
      });
    }
  }

  // Cleanup resolved incidents from the tracking set to prevent memory leaks over time
  // Wait, if we remove them, they might re-trigger if re-added. It's safer to keep 
  // track for a while, but for a simple demo, a Set without cleanup is fine for <1MB.
  // We'll limit the set size just in case.
  if (notifiedIncidents.size > 100) {
    const arr = Array.from(notifiedIncidents);
    notifiedIncidents.clear();
    arr.slice(-50).forEach(id => notifiedIncidents.add(id));
  }
}

// ── Notify on Route Change (Optional User Experience) ────────────────
let lastRecommendedGate = '';

export function notifyRouteChange(currentGate: string, reason: string): void {
  if (!currentGate || currentGate === 'none') return;
  
  if (lastRecommendedGate && lastRecommendedGate !== currentGate) {
    sendPushNotification('Routing Update', {
      body: `Rerouting you to ${currentGate}. ${reason}`,
      requireInteraction: false,
    });
  }
  
  lastRecommendedGate = currentGate;
}
