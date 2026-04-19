/**
 * SmartVenue Assistant — Shared Type Definitions
 * Centralizes all data interfaces for type safety across modules.
 */

// ── Density Categories ──────────────────────────────────────────────
export type DensityCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ── Zone Types ──────────────────────────────────────────────────────
export type ZoneType = 'gate' | 'restroom' | 'food' | 'seating' | 'exit';

// ── User Roles ──────────────────────────────────────────────────────
export type UserRole = 'attendee' | 'operator';

// ── Incident Types ──────────────────────────────────────────────────
export type IncidentType = 'crowd_spike' | 'zone_closure' | 'emergency';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

// ── Coordinate ──────────────────────────────────────────────────────
export interface LatLng {
  lat: number;
  lng: number;
}

// ── Venue Zone ──────────────────────────────────────────────────────
export interface ZoneData {
  zoneId: string;
  name: string;
  type: ZoneType;
  densityScore: number;          // 0–100
  densityCategory: DensityCategory;
  center: LatLng;
  polygon: LatLng[];             // boundary vertices
  capacity: number;
  currentOccupancy: number;
  isOpen: boolean;
  roomArea?: string;             // Detailed area info (e.g. 500m2)
  detailedLocation?: string;     // Specific room/loc (e.g. Level 2, Room B)
  timestamp: number;
}

// ── Queue State ─────────────────────────────────────────────────────
export interface QueueState {
  zoneId: string;
  zoneName: string;
  zoneType: ZoneType;
  queueLength: number;           // people in queue
  estimatedWaitMinutes: number;
  serviceRate: number;           // people served per minute
  velocity: number;              // queue growth rate (positive = growing)
  history: number[];             // recent queue lengths for prediction
  timestamp: number;
}

// ── Incident ────────────────────────────────────────────────────────
export interface Incident {
  incidentId: string;
  zoneId: string;
  zoneName: string;
  type: IncidentType;
  severity: IncidentSeverity;
  active: boolean;
  description: string;
  timestamp: number;
}

// ── Routing Suggestion ──────────────────────────────────────────────
export interface RoutingSuggestion {
  recommendedZoneId: string;
  recommendedGate: string;
  reason: string;
  score: number;
  category: ZoneType;
  alternatives: AlternativeRoute[];
}

export interface AlternativeRoute {
  zoneId: string;
  name: string;
  score: number;
  reason: string;
}

// ── Decision Engine Output ──────────────────────────────────────────
export interface NavigationDecision {
  recommendedGate: RoutingSuggestion;
  recommendedRestroom: RoutingSuggestion;
  recommendedFood: RoutingSuggestion;
  emergencyMode: boolean;
  emergencyExits: RoutingSuggestion | null;
  overallStatus: DensityCategory;
  reasoning: string[];
  timestamp: number;
}

// ── Decision Weights ────────────────────────────────────────────────
export interface DecisionWeights {
  distance: number;
  queue: number;
  density: number;
}

// ── Queue Prediction ────────────────────────────────────────────────
export interface QueuePrediction {
  zoneId: string;
  currentWait: number;
  predictedWait: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;            // 0–1
  timestamp: number;
}

// ── Venue Configuration ─────────────────────────────────────────────
export interface VenueConfig {
  name: string;
  center: LatLng;
  zoom: number;
  zones: ZoneData[];
}

// ── Application State ───────────────────────────────────────────────
export interface AppState {
  zones: Map<string, ZoneData>;
  queues: Map<string, QueueState>;
  incidents: Incident[];
  currentDecision: NavigationDecision | null;
  predictions: Map<string, QueuePrediction>;
  emergencyMode: boolean;
  userRole: UserRole;
  highContrastMode: boolean;
  userPosition: LatLng;
  aiLoading: boolean;
}

// ── Firebase Document Shapes ────────────────────────────────────────
export interface FirestoreZoneDoc {
  zoneId: string;
  densityScore: number;
  currentOccupancy: number;
  isOpen: boolean;
  timestamp: number;
}

export interface FirestoreQueueDoc {
  zoneId: string;
  queueLength: number;
  serviceRate: number;
  timestamp: number;
}

export interface FirestoreIncidentDoc {
  incidentId: string;
  zoneId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  active: boolean;
  description: string;
  timestamp: number;
}

export interface FirestoreRoutingDoc {
  recommendedGate: string;
  reason: string;
  score: number;
  timestamp: number;
}

// Firebase types are now handled by the official modular SDK imports.


