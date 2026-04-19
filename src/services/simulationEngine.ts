/**
 * SmartVenue — Simulation Engine (PromptWars Exhibition Hall)
 * Generates realistic exhibition venue data: booth density, stage crowding,
 * queue updates at registration/food, and incident triggers.
 * Pushes updates every 3 seconds to drive real-time intelligence.
 */

import { ZoneData, QueueState, Incident, LatLng, ZoneType, VenueConfig } from '../types.js';
import { classifyDensity } from '../utils/decisionEngine.js';
import { updateQueueHistory } from '../utils/queuePredictor.js';
import { writeZoneData, writeQueueData, writeIncident, isConnected } from '../services/firebaseService.js';

// ── Exhibition Hall Center (PromptWars Venue) ───────────────────────
const VENUE_CENTER: LatLng = { lat: 40.4531, lng: -3.6884 };

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

// ── Create Exhibition Hall Layout ───────────────────────────────────
export function createVenueConfig(): VenueConfig {
  const r = 0.0015;
  const zoneDefinitions = [
    // ─── Registration & Entry Gates ─────────────────────────────
    { zoneId: 'reg-main', name: 'Main Registration', type: 'gate' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.004, lng: VENUE_CENTER.lng }, capacity: 2000, detailedLocation: 'Hall Entrance, Ground Floor', roomArea: '350m²' },
    { zoneId: 'reg-vip', name: 'VIP & Speaker Check-in', type: 'gate' as ZoneType, center: { lat: VENUE_CENTER.lat, lng: VENUE_CENTER.lng + 0.005 }, capacity: 500, detailedLocation: 'East Wing, Level 1', roomArea: '120m²' },
    { zoneId: 'reg-south', name: 'South Entrance', type: 'gate' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.004, lng: VENUE_CENTER.lng }, capacity: 1800, detailedLocation: 'South Lobby', roomArea: '280m²' },
    { zoneId: 'reg-press', name: 'Press & Media Entry', type: 'gate' as ZoneType, center: { lat: VENUE_CENTER.lat, lng: VENUE_CENTER.lng - 0.005 }, capacity: 400, detailedLocation: 'West Wing, Ground Floor', roomArea: '100m²' },

    // ─── Exhibition Booth Clusters ──────────────────────────────
    { zoneId: 'booth-a', name: 'Booth Zone A (AI/ML)', type: 'seating' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.002, lng: VENUE_CENTER.lng + 0.001 }, capacity: 800, detailedLocation: 'Hall A, Booths A1–A20', roomArea: '1200m²' },
    { zoneId: 'booth-b', name: 'Booth Zone B (Cloud)', type: 'seating' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.001, lng: VENUE_CENTER.lng - 0.002 }, capacity: 600, detailedLocation: 'Hall B, Booths B1–B15', roomArea: '900m²' },
    { zoneId: 'booth-c', name: 'Booth Zone C (DevTools)', type: 'seating' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.001, lng: VENUE_CENTER.lng + 0.002 }, capacity: 700, detailedLocation: 'Hall C, Booths C1–C18', roomArea: '1050m²' },
    { zoneId: 'booth-d', name: 'Booth Zone D (Startups)', type: 'seating' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.002, lng: VENUE_CENTER.lng - 0.001 }, capacity: 500, detailedLocation: 'Hall D, Booths D1–D12', roomArea: '750m²' },

    // ─── Keynote & Workshop Stages ──────────────────────────────
    { zoneId: 'stage-main', name: 'Main Keynote Stage', type: 'seating' as ZoneType, center: { lat: VENUE_CENTER.lat, lng: VENUE_CENTER.lng }, capacity: 3000, detailedLocation: 'Central Arena, Level 0', roomArea: '2500m²' },
    { zoneId: 'stage-work', name: 'Workshop Theater', type: 'seating' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.003, lng: VENUE_CENTER.lng - 0.003 }, capacity: 400, detailedLocation: 'West Mezzanine, Room W2', roomArea: '320m²' },

    // ─── Networking & Lounge Areas ──────────────────────────────
    { zoneId: 'lounge-dev', name: 'Developer Lounge', type: 'restroom' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.0025, lng: VENUE_CENTER.lng + 0.003 }, capacity: 250, detailedLocation: 'East Mezzanine, Level 1', roomArea: '200m²' },
    { zoneId: 'lounge-net', name: 'Networking Hub', type: 'restroom' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.0025, lng: VENUE_CENTER.lng + 0.003 }, capacity: 300, detailedLocation: 'South Atrium', roomArea: '280m²' },

    // ─── Food & Beverage ────────────────────────────────────────
    { zoneId: 'food-main', name: 'Main Food Court', type: 'food' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.003, lng: VENUE_CENTER.lng + 0.002 }, capacity: 600, detailedLocation: 'North Wing, Level 1', roomArea: '450m²' },
    { zoneId: 'food-cafe', name: 'Sponsor Café', type: 'food' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.003, lng: VENUE_CENTER.lng - 0.002 }, capacity: 300, detailedLocation: 'South Wing, Ground Floor', roomArea: '180m²' },
    { zoneId: 'food-snack', name: 'Quick Bites Station', type: 'food' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.001, lng: VENUE_CENTER.lng + 0.004 }, capacity: 200, detailedLocation: 'East Corridor', roomArea: '80m²' },

    // ─── Emergency Exits ────────────────────────────────────────
    { zoneId: 'exit-ne', name: 'Emergency Exit NE', type: 'exit' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.0035, lng: VENUE_CENTER.lng + 0.004 }, capacity: 1000, detailedLocation: 'NE Stairwell' },
    { zoneId: 'exit-se', name: 'Emergency Exit SE', type: 'exit' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.0035, lng: VENUE_CENTER.lng + 0.004 }, capacity: 1000, detailedLocation: 'SE Fire Escape' },
    { zoneId: 'exit-sw', name: 'Emergency Exit SW', type: 'exit' as ZoneType, center: { lat: VENUE_CENTER.lat - 0.0035, lng: VENUE_CENTER.lng - 0.004 }, capacity: 1200, detailedLocation: 'SW Loading Bay' },
    { zoneId: 'exit-nw', name: 'Emergency Exit NW', type: 'exit' as ZoneType, center: { lat: VENUE_CENTER.lat + 0.0035, lng: VENUE_CENTER.lng - 0.004 }, capacity: 1100, detailedLocation: 'NW Service Corridor' },
  ];

  const zones: ZoneData[] = zoneDefinitions.map((z) => ({
    ...z,
    densityScore: 10 + Math.random() * 30,
    densityCategory: 'LOW' as const,
    polygon: makePolygon(z.center, r),
    currentOccupancy: Math.floor(z.capacity * 0.1),
    isOpen: true,
    roomArea: z.roomArea || undefined,
    detailedLocation: z.detailedLocation || undefined,
    timestamp: Date.now(),
  }));

  return { name: 'PromptWars International Exhibition Hall', center: VENUE_CENTER, zoom: 15, zones };
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
  const phaseOffset = zone.zoneId.charCodeAt(zone.zoneId.length - 1) * 0.7;
  const sineComponent = Math.sin(t + phaseOffset) * 15;
  const noise = (Math.random() - 0.5) * 10;
  // Keynote surge: stages spike harder during "talk" cycles
  const isStage = zone.zoneId.startsWith('stage');
  const eventSpike = Math.random() > (isStage ? 0.90 : 0.95) ? Math.random() * (isStage ? 35 : 25) : 0;

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
