/**
 * SmartVenue — Simulation Engine
 * Generates realistic venue data: density changes, queue updates, and incident triggers.
 * Pushes updates every 3 seconds to drive real-time intelligence.
 */

import { ZoneData, QueueState, Incident, LatLng, ZoneType, VenueConfig } from '../types.js';
import { classifyDensity } from '../utils/decisionEngine.js';
import { updateQueueHistory } from '../utils/queuePredictor.js';
import { writeZoneData, writeQueueData, writeIncident, isConnected } from '../services/firebaseService.js';

// ── Stadium Center (Generic Venue Location) ─────────────────────────
const VENUE_CENTER: LatLng = { lat: 40.4531, lng: -3.6884 }; // Madrid area

// ── Generate Zone Polygon (hexagonal approximation) ─────────────────
function makePolygon(center: LatLng, radius: number, sides: number = 6): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    pts.push({
      lat: center.lat + radius * Math.cos(angle),
      lng: center.lng + radius * 1.3 * Math.sin(angle),
    });
  }
  return pts;
}

// ── Create Initial Venue Layout ─────────────────────────────────────
export function createVenueConfig(): VenueConfig {
  const r = 0.0015; // zone radius in degrees
  const zoneDefinitions = [
    // Gates
    { zoneId: 'gate-a', name: 'Gate A (North)', type: 'gate' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.004, lng: VENUE_CENTER.lng }, capacity: 2000 },
    { zoneId: 'gate-b', name: 'Gate B (East)', type: 'gate' as ZoneType, center: { lat: VENUE_CENTER.lat, lng: VENUE_CENTER.lng + 0.005 }, capacity: 1800 },
    { zoneId: 'gate-c', name: 'Gate C (South)', type: 'gate' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.004, lng: VENUE_CENTER.lng }, capacity: 2200 },
    { zoneId: 'gate-d', name: 'Gate D (West)', type: 'gate' as ZoneType, center: { lat: VENUE_CENTER.lat, lng: VENUE_CENTER.lng - 0.005 }, capacity: 1600 },
    // Restrooms
    { zoneId: 'restroom-ne', name: 'Restroom NE', type: 'restroom' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.0025, lng: VENUE_CENTER.lng + 0.003 }, capacity: 200 },
    { zoneId: 'restroom-se', name: 'Restroom SE', type: 'restroom' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.0025, lng: VENUE_CENTER.lng + 0.003 }, capacity: 200 },
    { zoneId: 'restroom-sw', name: 'Restroom SW', type: 'restroom' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.0025, lng: VENUE_CENTER.lng - 0.003 }, capacity: 180 },
    { zoneId: 'restroom-nw', name: 'Restroom NW', type: 'restroom' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.0025, lng: VENUE_CENTER.lng - 0.003 }, capacity: 220 },
    // Food Stalls
    { zoneId: 'food-n', name: 'Food Court North', type: 'food' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.003, lng: VENUE_CENTER.lng + 0.002 }, capacity: 500 },
    { zoneId: 'food-e', name: 'Food Court East', type: 'food' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.001, lng: VENUE_CENTER.lng + 0.004 }, capacity: 400 },
    { zoneId: 'food-s', name: 'Food Court South', type: 'food' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.003, lng: VENUE_CENTER.lng - 0.002 }, capacity: 450 },
    { zoneId: 'food-w', name: 'Food Court West', type: 'food' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.001, lng: VENUE_CENTER.lng - 0.004 }, capacity: 380 },
    // Seating Sections
    { zoneId: 'seat-n', name: 'Section North', type: 'seating' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.002, lng: VENUE_CENTER.lng }, capacity: 5000 },
    { zoneId: 'seat-e', name: 'Section East', type: 'seating' as ZoneType, center: { lat: VENUE_CENTER.lat, lng: VENUE_CENTER.lng + 0.002 }, capacity: 4500 },
    { zoneId: 'seat-s', name: 'Section South', type: 'seating' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.002, lng: VENUE_CENTER.lng }, capacity: 5000 },
    { zoneId: 'seat-w', name: 'Section West', type: 'seating' as ZoneType, center: { lat: VENUE_CENTER.lat, lng: VENUE_CENTER.lng - 0.002 }, capacity: 4000 },
    // Emergency Exits
    { zoneId: 'exit-ne', name: 'Exit NE', type: 'exit' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.0035, lng: VENUE_CENTER.lng + 0.004 }, capacity: 1000 },
    { zoneId: 'exit-se', name: 'Exit SE', type: 'exit' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.0035, lng: VENUE_CENTER.lng + 0.004 }, capacity: 1000 },
    { zoneId: 'exit-sw', name: 'Exit SW', type: 'exit' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.0035, lng: VENUE_CENTER.lng - 0.004 }, capacity: 1200 },
    { zoneId: 'exit-nw', name: 'Exit NW', type: 'exit' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.0035, lng: VENUE_CENTER.lng - 0.004 }, capacity: 1100 },
  ];

  const zones: ZoneData[] = zoneDefinitions.map((z) => ({
    ...z,
    densityScore: 10 + Math.random() * 30,
    densityCategory: 'LOW' as const,
    polygon: makePolygon(z.center, r),
    currentOccupancy: Math.floor(z.capacity * 0.1),
    isOpen: true,
    timestamp: Date.now(),
  }));

  return { name: 'SmartVenue Exhibition Hall', center: VENUE_CENTER, zoom: 15, zones };
}

// ── Create Initial Queue States ─────────────────────────────────────
export function createInitialQueues(zones: ZoneData[]): Map<string, QueueState> {
  const queues = new Map<string, QueueState>();
  for (const zone of zones) {
    if (['gate', 'restroom', 'food'].includes(zone.type)) {
      const baseQueue = 2 + Math.floor(Math.random() * 10);
      queues.set(zone.zoneId, {
        zoneId: zone.zoneId, zoneName: zone.name, zoneType: zone.type,
        queueLength: baseQueue, estimatedWaitMinutes: Math.round(baseQueue / 3),
        serviceRate: 2 + Math.random() * 3, velocity: 0,
        history: [baseQueue], timestamp: Date.now(),
      });
    }
  }
  return queues;
}

// ── Simulation Tick Logic ───────────────────────────────────────────
let tickCount = 0;

function simulateDensityChange(zone: ZoneData): ZoneData {
  const t = tickCount * 0.15;
  // Sinusoidal base pattern with zone-specific phase offset
  const phaseOffset = zone.zoneId.charCodeAt(zone.zoneId.length - 1) * 0.7;
  const sineComponent = Math.sin(t + phaseOffset) * 15;
  const noise = (Math.random() - 0.5) * 10;
  // Event-driven spikes for realism
  const eventSpike = Math.random() > 0.95 ? Math.random() * 25 : 0;

  let newDensity = zone.densityScore + sineComponent * 0.1 + noise * 0.3 + eventSpike;
  newDensity = Math.max(5, Math.min(98, newDensity));

  const occupancy = Math.floor((newDensity / 100) * zone.capacity);

  return {
    ...zone,
    densityScore: Math.round(newDensity * 10) / 10,
    densityCategory: classifyDensity(newDensity),
    currentOccupancy: occupancy,
    timestamp: Date.now(),
  };
}

function simulateQueueChange(queue: QueueState): QueueState {
  const noise = Math.floor((Math.random() - 0.45) * 4);
  const newLength = Math.max(0, queue.queueLength + noise);
  return updateQueueHistory(queue, newLength);
}

// ── Run Single Simulation Tick ──────────────────────────────────────
export function simulationTick(
  zones: Map<string, ZoneData>,
  queues: Map<string, QueueState>,
): { zones: Map<string, ZoneData>; queues: Map<string, QueueState> } {
  tickCount++;
  const newZones = new Map<string, ZoneData>();
  const newQueues = new Map<string, QueueState>();

  for (const [id, zone] of zones) {
    const updated = simulateDensityChange(zone);
    newZones.set(id, updated);
    if (isConnected()) writeZoneData(updated);
  }

  for (const [id, queue] of queues) {
    const updated = simulateQueueChange(queue);
    newQueues.set(id, updated);
    if (isConnected()) writeQueueData(updated);
  }

  return { zones: newZones, queues: newQueues };
}

// ── Start Simulation Loop ───────────────────────────────────────────
export function startSimulation(
  zones: Map<string, ZoneData>,
  queues: Map<string, QueueState>,
  onUpdate: (z: Map<string, ZoneData>, q: Map<string, QueueState>) => void,
  intervalMs: number = 3000,
): () => void {
  let currentZones = zones;
  let currentQueues = queues;

  const timer = setInterval(() => {
    const result = simulationTick(currentZones, currentQueues);
    currentZones = result.zones;
    currentQueues = result.queues;
    onUpdate(currentZones, currentQueues);
  }, intervalMs);

  return () => clearInterval(timer);
}
