/**
 * SmartVenue — Firebase Service Layer
 * Handles Firestore operations with fallback to local simulation mode.
 */

import {
  ZoneData, QueueState, Incident, FirestoreZoneDoc,
  FirestoreQueueDoc, FirestoreIncidentDoc, FirestoreRoutingDoc,
} from '../types.js';
import { sanitizeFirestoreDoc } from '../security/validation.js';

// Firebase types (loaded via CDN globals)
declare const firebase: any;

let db: any = null;
let isFirebaseAvailable = false;

// ── Initialize Firebase ─────────────────────────────────────────────
export function initFirebase(config: Record<string, string>): boolean {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('[Firebase] SDK not loaded — running in simulation mode');
      return false;
    }
    if (!firebase.apps?.length) {
      firebase.initializeApp(config);
    }
    db = firebase.firestore();
    isFirebaseAvailable = true;
    console.info('[Firebase] Connected successfully');
    return true;
  } catch (err) {
    console.warn('[Firebase] Init failed — running in simulation mode', err);
    return false;
  }
}

export function isConnected(): boolean {
  return isFirebaseAvailable;
}

// ── Write Zone Data ─────────────────────────────────────────────────
export async function writeZoneData(zone: ZoneData): Promise<void> {
  if (!db) return;
  const doc: FirestoreZoneDoc = sanitizeFirestoreDoc({
    zoneId: zone.zoneId,
    densityScore: zone.densityScore,
    currentOccupancy: zone.currentOccupancy,
    isOpen: zone.isOpen,
    timestamp: Date.now(),
  });
  try {
    await db.collection('zones').doc(zone.zoneId).set(doc, { merge: true });
  } catch (err) {
    console.error('[Firebase] Write zone failed:', err);
  }
}

// ── Write Queue Data ────────────────────────────────────────────────
export async function writeQueueData(queue: QueueState): Promise<void> {
  if (!db) return;
  const doc: FirestoreQueueDoc = sanitizeFirestoreDoc({
    zoneId: queue.zoneId,
    queueLength: queue.queueLength,
    serviceRate: queue.serviceRate,
    timestamp: Date.now(),
  });
  try {
    await db.collection('queues').doc(queue.zoneId).set(doc, { merge: true });
  } catch (err) {
    console.error('[Firebase] Write queue failed:', err);
  }
}

// ── Write Incident ──────────────────────────────────────────────────
export async function writeIncident(incident: Incident): Promise<void> {
  if (!db) return;
  const doc: FirestoreIncidentDoc = sanitizeFirestoreDoc({
    incidentId: incident.incidentId,
    zoneId: incident.zoneId,
    type: incident.type,
    severity: incident.severity,
    active: incident.active,
    description: incident.description,
    timestamp: Date.now(),
  });
  try {
    await db.collection('incidents').doc(incident.incidentId).set(doc);
  } catch (err) {
    console.error('[Firebase] Write incident failed:', err);
  }
}

// ── Write Routing Suggestion ────────────────────────────────────────
export async function writeRoutingSuggestion(gate: string, reason: string, score: number): Promise<void> {
  if (!db) return;
  const doc: FirestoreRoutingDoc = sanitizeFirestoreDoc({
    recommendedGate: gate,
    reason: reason,
    score: score,
    timestamp: Date.now(),
  });
  try {
    await db.collection('routingSuggestions').doc('latest').set(doc);
  } catch (err) {
    console.error('[Firebase] Write routing failed:', err);
  }
}

// ── Listen for Real-Time Updates ────────────────────────────────────
export function listenToZones(callback: (zones: FirestoreZoneDoc[]) => void): () => void {
  if (!db) return () => {};
  return db.collection('zones').onSnapshot((snapshot: any) => {
    const zones = snapshot.docs.map((doc: any) => doc.data() as FirestoreZoneDoc);
    callback(zones);
  });
}

export function listenToIncidents(callback: (incidents: FirestoreIncidentDoc[]) => void): () => void {
  if (!db) return () => {};
  return db.collection('incidents').where('active', '==', true).onSnapshot((snapshot: any) => {
    const incidents = snapshot.docs.map((doc: any) => doc.data() as FirestoreIncidentDoc);
    callback(incidents);
  });
}
