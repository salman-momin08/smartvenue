/**
 * SmartVenue — Decision Engine
 * 
 * Core intelligence module that evaluates venue conditions and produces
 * optimal navigation decisions. Scoring formula:
 * 
 *   score = (distance_weight × distance_factor)
 *         + (queue_weight × queue_factor)
 *         + (density_weight × density_factor)
 * 
 * Lower score = better recommendation.
 */

import {
  ZoneData,
  QueueState,
  Incident,
  NavigationDecision,
  RoutingSuggestion,
  AlternativeRoute,
  DecisionWeights,
  DensityCategory,
  LatLng,
  ZoneType,
} from '../types.js';

// ── Default Weights ─────────────────────────────────────────────────
const DEFAULT_WEIGHTS: DecisionWeights = {
  distance: 0.3,
  queue: 0.35,
  density: 0.35,
};

const EMERGENCY_WEIGHTS: DecisionWeights = {
  distance: 0.6,
  queue: 0.1,
  density: 0.3,
};

// ── Density Thresholds ──────────────────────────────────────────────
export function classifyDensity(score: number): DensityCategory {
  if (score < 25) return 'LOW';
  if (score < 50) return 'MEDIUM';
  if (score < 75) return 'HIGH';
  return 'CRITICAL';
}

// ── Haversine Distance (meters) ─────────────────────────────────────
/**
 * Calculates the great-circle distance between two points on a sphere given their longitudes and latitudes.
 * It uses the Haversine formula, which remains accurate even for small distances.
 * 
 * @param {LatLng} a - The starting coordinate (e.g., user position)
 * @param {LatLng} b - The ending coordinate (e.g., zone center)
 * @returns {number} The distance in meters
 */
function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ── Score a Single Zone ─────────────────────────────────────────────
/**
 * Evaluates a zone's suitability for a user by calculating a weighted multi-factor score.
 * A lower score indicates a more favorable recommendation.
 * 
 * Math:
 * 1. Distance Factor = min(haversine_distance / 500m, 1.0)
 * 2. Queue Factor = min(estimated_wait / 30m, 1.0)
 * 3. Density Factor = density_score / 100
 * 4. Total Score = (Wd * DF) + (Wq * QF) + (Wden * DenF) + IncidentPenalty
 * 
 * @param {ZoneData} zone - The target zone's real-time state
 * @param {QueueState | undefined} queue - The current queue metrics for the zone
 * @param {LatLng} userPos - The current mock GPS coordinates of the user
 * @param {DecisionWeights} weights - The algorithmic weights applied to distance, queue, and density
 * @param {Incident[]} incidents - List of currently active venue incidents
 * @returns {number} The final computed decision score (Infinity if closed or critically unsafe)
 */
function scoreZone(
  zone: ZoneData,
  queue: QueueState | undefined,
  userPos: LatLng,
  weights: DecisionWeights,
  incidents: Incident[],
): number {
  // Zone closed or has active critical incident → maximum penalty
  const activeIncidents = incidents.filter(
    (i) => i.zoneId === zone.zoneId && i.active
  );
  if (!zone.isOpen || activeIncidents.some((i) => i.severity === 'critical')) {
    return Infinity;
  }

  // Distance factor: normalized to 0–1 (assuming max venue distance ~500m)
  const dist = haversineDistance(userPos, zone.center);
  const distanceFactor = Math.min(dist / 500, 1);

  // Queue factor: normalized queue wait time (max 30 min)
  const queueWait = queue?.estimatedWaitMinutes ?? 0;
  const queueFactor = Math.min(queueWait / 30, 1);

  // Density factor: normalized density score
  const densityFactor = zone.densityScore / 100;

  // Incident penalty: add penalty for active incidents
  const incidentPenalty = activeIncidents.reduce((sum, inc) => {
    switch (inc.severity) {
      case 'low': return sum + 0.05;
      case 'medium': return sum + 0.15;
      case 'high': return sum + 0.35;
      case 'critical': return sum + 1.0;
      default: return sum;
    }
  }, 0);

  const rawScore =
    weights.distance * distanceFactor +
    weights.queue * queueFactor +
    weights.density * densityFactor +
    incidentPenalty;

  return Math.round(rawScore * 1000) / 1000;
}

// ── Build Reasoning String ──────────────────────────────────────────
function buildReason(
  zone: ZoneData,
  queue: QueueState | undefined,
  incidents: Incident[],
): string {
  const parts: string[] = [];
  const density = classifyDensity(zone.densityScore);

  if (density === 'LOW') parts.push('low congestion');
  else if (density === 'MEDIUM') parts.push('moderate congestion');
  else if (density === 'HIGH') parts.push('high congestion — consider alternatives');

  if (queue) {
    if (queue.queueLength <= 5) parts.push('short queue');
    else if (queue.queueLength <= 15) parts.push(`moderate queue (${queue.queueLength} people)`);
    else parts.push(`long queue (${queue.queueLength} people, ~${queue.estimatedWaitMinutes}min wait)`);
  }

  const zoneIncidents = incidents.filter((i) => i.zoneId === zone.zoneId && i.active);
  if (zoneIncidents.length > 0) {
    parts.push(`⚠ ${zoneIncidents.length} active incident(s)`);
  }

  return parts.join(', ');
}

// ── Find Best Zone by Type ──────────────────────────────────────────
function findBestByType(
  type: ZoneType,
  zones: Map<string, ZoneData>,
  queues: Map<string, QueueState>,
  incidents: Incident[],
  userPos: LatLng,
  weights: DecisionWeights,
): RoutingSuggestion {
  const candidates = Array.from(zones.values()).filter((z) => z.type === type);

  const scored = candidates.map((zone) => {
    const queue = queues.get(zone.zoneId);
    const score = scoreZone(zone, queue, userPos, weights, incidents);
    const reason = buildReason(zone, queue, incidents);
    return { zone, queue, score, reason };
  });

  scored.sort((a, b) => a.score - b.score);

  const best = scored[0];
  if (!best) {
    return {
      recommendedZoneId: 'none',
      recommendedGate: 'N/A',
      reason: `No available ${type} zones`,
      score: Infinity,
      category: type,
      alternatives: [],
    };
  }

  const alternatives: AlternativeRoute[] = scored.slice(1, 4).map((s) => ({
    zoneId: s.zone.zoneId,
    name: s.zone.name,
    score: s.score,
    reason: s.reason,
  }));

  return {
    recommendedZoneId: best.zone.zoneId,
    recommendedGate: best.zone.name,
    reason: `${best.zone.name} recommended: ${best.reason}`,
    score: best.score,
    category: type,
    alternatives,
  };
}

// ── Compute Overall Venue Status ────────────────────────────────────
function computeOverallStatus(zones: Map<string, ZoneData>): DensityCategory {
  const scores = Array.from(zones.values()).map((z) => z.densityScore);
  if (scores.length === 0) return 'LOW';
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return classifyDensity(avg);
}

// ── Build Overall Reasoning ─────────────────────────────────────────
function buildOverallReasoning(
  zones: Map<string, ZoneData>,
  incidents: Incident[],
  emergencyMode: boolean,
): string[] {
  const reasoning: string[] = [];

  const avgDensity =
    Array.from(zones.values()).reduce((s, z) => s + z.densityScore, 0) / zones.size || 0;
  reasoning.push(`Average venue density: ${Math.round(avgDensity)}% — ${classifyDensity(avgDensity)}`);

  const criticalZones = Array.from(zones.values()).filter(
    (z) => classifyDensity(z.densityScore) === 'CRITICAL'
  );
  if (criticalZones.length > 0) {
    reasoning.push(
      `⚠ Critical zones: ${criticalZones.map((z) => z.name).join(', ')}`
    );
  }

  const activeIncidents = incidents.filter((i) => i.active);
  if (activeIncidents.length > 0) {
    reasoning.push(
      `🚨 ${activeIncidents.length} active incident(s): ${activeIncidents.map((i) => i.description).join('; ')}`
    );
  }

  const closedZones = Array.from(zones.values()).filter((z) => !z.isOpen);
  if (closedZones.length > 0) {
    reasoning.push(`🚫 Closed zones: ${closedZones.map((z) => z.name).join(', ')}`);
  }

  if (emergencyMode) {
    reasoning.push('🔴 EMERGENCY MODE: Routing to nearest safe exits');
  }

  return reasoning;
}

// ── Main Decision Function ──────────────────────────────────────────
export function computeDecision(
  zones: Map<string, ZoneData>,
  queues: Map<string, QueueState>,
  incidents: Incident[],
  userPos: LatLng,
  emergencyMode: boolean,
): NavigationDecision {
  const weights = emergencyMode ? EMERGENCY_WEIGHTS : DEFAULT_WEIGHTS;

  const recommendedGate = findBestByType('gate', zones, queues, incidents, userPos, weights);
  const recommendedRestroom = findBestByType('restroom', zones, queues, incidents, userPos, weights);
  const recommendedFood = findBestByType('food', zones, queues, incidents, userPos, weights);

  let emergencyExits: RoutingSuggestion | null = null;
  if (emergencyMode) {
    emergencyExits = findBestByType('exit', zones, queues, incidents, userPos, EMERGENCY_WEIGHTS);
  }

  const overallStatus = computeOverallStatus(zones);
  const reasoning = buildOverallReasoning(zones, incidents, emergencyMode);

  return {
    recommendedGate,
    recommendedRestroom,
    recommendedFood,
    emergencyMode,
    emergencyExits,
    overallStatus,
    reasoning,
    timestamp: Date.now(),
  };
}

// ── Exported for testing ────────────────────────────────────────────
export const _testing = {
  scoreZone,
  haversineDistance,
  buildReason,
  findBestByType,
  computeOverallStatus,
  DEFAULT_WEIGHTS,
  EMERGENCY_WEIGHTS,
};
