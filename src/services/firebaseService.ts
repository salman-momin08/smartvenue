/**
 * SmartVenue — Firebase Integration Service (Modular)
 * Manages real-time data sync for zones, queues, and incidents.
 */

import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where,
  Timestamp,
  Firestore,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { GoogleServiceProvider } from './GoogleServiceProvider.js';

let db: Firestore | null = null;
let connected = false;

/**
 * Initializes the Firestore connection using the modular SDK.
 */
export function initFirebase(config: any): void {
  const provider = GoogleServiceProvider.getInstance();
  db = provider.db;
  if (db) {
    connected = true;
    console.info('[Firebase] Modular Firestore service ready');
  }
}

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
 */
export async function writeIncident(incident: any): Promise<void> {
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
 */
export async function writeQueueData(queue: any): Promise<void> {
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
 */
export async function writeZoneData(zone: any): Promise<void> {
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
 * Syncs zone data from Firestore (example for live mode).
 */
export function syncZones(callback: (zones: any[]) => void): () => void {
  if (!db) return () => {};
  const q = query(collection(db, 'zones'));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const zones = snapshot.docs.map(d => d.data());
    callback(zones);
  });
}

