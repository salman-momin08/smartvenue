/**
 * SmartVenue — Firebase Integration Service (Strictly Typed)
 * Manages real-time data sync for zones, queues, and incidents.
 */

import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  Timestamp,
  Firestore,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { GoogleServiceProvider } from './GoogleServiceProvider.js';
import { ZoneData, QueueState, Incident } from '../types.js';

let db: Firestore | null = null;
let connected = false;

/**
 * Initializes the Firestore connection using the modular SDK.
 * @param {any} _config Left for signature compatibility, pulls from provider
 */
export function initFirebase(_config: any): void {
  const provider = GoogleServiceProvider.getInstance();
  db = provider.db;
  if (db) {
    connected = true;
    console.info('[Firebase] Modular Firestore service ready');
  }
}

/**
 * @returns {boolean} True if Firestore is initialized and connected
 */
export function isConnected(): boolean {
  return connected && db !== null;
}

/**
 * Writes a routing suggestion to Firestore for centralized monitoring.
 */
export async function writeRoutingSuggestion(gate: string, reason: string, score: number): Promise<void> {
  if (!db) return;
  try {
    const docRef = doc(db, 'analytics', 'current_routing');
    await setDoc(docRef, {
      recommendedGate: gate,
      reason,
      score,
      timestamp: Timestamp.now()
    }, { merge: true });
  } catch (err) {
    console.warn('[Firebase] Write routing failed:', err);
  }
}

/**
 * Writes an active incident to Firestore.
 * @param {Incident} incident The incident object to persist
 */
export async function writeIncident(incident: Incident): Promise<void> {
  if (!db) return;
  try {
    const docRef = doc(db, 'incidents', incident.incidentId);
    await setDoc(docRef, {
      ...incident,
      timestamp: Timestamp.now()
    });
  } catch (err) {
    console.warn('[Firebase] Write incident failed:', err);
  }
}

/**
 * Writes live queue metrics to Firestore.
 * @param {QueueState} queue The queue state to persist
 */
export async function writeQueueData(queue: QueueState): Promise<void> {
  if (!db) return;
  try {
    const docRef = doc(db, 'queues', queue.zoneId);
    await setDoc(docRef, {
      ...queue,
      timestamp: Timestamp.now()
    });
  } catch (err) {
    console.warn('[Firebase] Write queue failed:', err);
  }
}

/**
 * Writes live zone occupancy and density metrics to Firestore.
 * @param {ZoneData} zone The zone data to persist
 */
export async function writeZoneData(zone: ZoneData): Promise<void> {
  if (!db) return;
  try {
    const docRef = doc(db, 'zones', zone.zoneId);
    await setDoc(docRef, {
      ...zone,
      timestamp: Timestamp.now()
    });
  } catch (err) {
    console.warn('[Firebase] Write zone failed:', err);
  }
}

/**
 * Syncs zone data from Firestore.
 * @param {Function} callback Function to handle the array of zones
 * @returns {Function} Unsubscribe function
 */
export function syncZones(callback: (zones: ZoneData[]) => void): () => void {
  if (!db) return () => {};
  const q = query(collection(db, 'zones'));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const zones = snapshot.docs.map(d => d.data() as ZoneData);
    callback(zones);
  });
}
