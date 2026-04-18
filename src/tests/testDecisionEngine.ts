/**
 * SmartVenue — Decision Engine Tests
 * Run with: npm run test
 */

import { computeDecision, classifyDensity, _testing } from '../assistant/decisionEngine.js';
import { predictQueue, _testing as qTesting } from '../assistant/queuePredictor.js';
import { ZoneData, QueueState, Incident, LatLng } from '../types.js';

const { scoreZone, haversineDistance, DEFAULT_WEIGHTS } = _testing;
const { computeEMA, computeVelocity, determineTrend } = qTesting;

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ FAIL: ${name}`); }
}

function makeZone(overrides: Partial<ZoneData>): ZoneData {
  return {
    zoneId: 'test', name: 'Test Zone', type: 'gate', densityScore: 30,
    densityCategory: 'MEDIUM', center: { lat: 40.45, lng: -3.69 },
    polygon: [], capacity: 1000, currentOccupancy: 300, isOpen: true, timestamp: Date.now(),
    ...overrides,
  };
}

function makeQueue(overrides: Partial<QueueState>): QueueState {
  return {
    zoneId: 'test', zoneName: 'Test', zoneType: 'gate', queueLength: 10,
    estimatedWaitMinutes: 3, serviceRate: 3, velocity: 0,
    history: [8, 9, 10], timestamp: Date.now(),
    ...overrides,
  };
}

// ── Density Classification ──────────────────────────────────────────
console.log('\n🧪 Density Classification Tests');
assert(classifyDensity(10) === 'LOW', 'Score 10 → LOW');
assert(classifyDensity(24) === 'LOW', 'Score 24 → LOW');
assert(classifyDensity(25) === 'MEDIUM', 'Score 25 → MEDIUM');
assert(classifyDensity(49) === 'MEDIUM', 'Score 49 → MEDIUM');
assert(classifyDensity(50) === 'HIGH', 'Score 50 → HIGH');
assert(classifyDensity(74) === 'HIGH', 'Score 74 → HIGH');
assert(classifyDensity(75) === 'CRITICAL', 'Score 75 → CRITICAL');
assert(classifyDensity(100) === 'CRITICAL', 'Score 100 → CRITICAL');

// ── Distance Calculation ────────────────────────────────────────────
console.log('\n🧪 Distance Tests');
const dist = haversineDistance({ lat: 40.45, lng: -3.69 }, { lat: 40.45, lng: -3.69 });
assert(dist < 0.01, 'Same point → ~0 meters');
const dist2 = haversineDistance({ lat: 40.45, lng: -3.69 }, { lat: 40.455, lng: -3.69 });
assert(dist2 > 400 && dist2 < 700, 'Short distance is reasonable');

// ── Zone Scoring ────────────────────────────────────────────────────
console.log('\n🧪 Zone Scoring Tests');
const userPos: LatLng = { lat: 40.453, lng: -3.688 };

const lowDensityZone = makeZone({ zoneId: 'gate-b', densityScore: 15 });
const highDensityZone = makeZone({ zoneId: 'gate-a', densityScore: 85 });

const scoreLow = scoreZone(lowDensityZone, undefined, userPos, DEFAULT_WEIGHTS, []);
const scoreHigh = scoreZone(highDensityZone, undefined, userPos, DEFAULT_WEIGHTS, []);
assert(scoreLow < scoreHigh, 'Low density zone scores better than high density');

// Zone with queue
const queuedZone = makeZone({ zoneId: 'gate-c', densityScore: 20 });
const longQueue = makeQueue({ zoneId: 'gate-c', estimatedWaitMinutes: 15 });
const noQueue = makeQueue({ zoneId: 'gate-d', estimatedWaitMinutes: 1 });
const scoreQueued = scoreZone(queuedZone, longQueue, userPos, DEFAULT_WEIGHTS, []);
const scoreNoQueue = scoreZone(queuedZone, noQueue, userPos, DEFAULT_WEIGHTS, []);
assert(scoreNoQueue < scoreQueued, 'Short queue scores better than long queue');

// Closed zone → Infinity
const closedZone = makeZone({ isOpen: false });
const closedScore = scoreZone(closedZone, undefined, userPos, DEFAULT_WEIGHTS, []);
assert(closedScore === Infinity, 'Closed zone → Infinity score');

// Critical incident → Infinity
const incidentZone = makeZone({ zoneId: 'inc-zone' });
const critIncident: Incident = {
  incidentId: 'i1', zoneId: 'inc-zone', zoneName: 'Test', type: 'emergency',
  severity: 'critical', active: true, description: 'Test', timestamp: Date.now(),
};
const incScore = scoreZone(incidentZone, undefined, userPos, DEFAULT_WEIGHTS, [critIncident]);
assert(incScore === Infinity, 'Critical incident → Infinity score');

// ── Full Decision: Recommend Gate B Over Gate A ─────────────────────
console.log('\n🧪 Full Decision Tests');

const zones = new Map<string, ZoneData>();
zones.set('gate-a', makeZone({ zoneId: 'gate-a', name: 'Gate A', type: 'gate', densityScore: 80, center: { lat: 40.457, lng: -3.688 } }));
zones.set('gate-b', makeZone({ zoneId: 'gate-b', name: 'Gate B', type: 'gate', densityScore: 20, center: { lat: 40.453, lng: -3.683 } }));
zones.set('restroom-1', makeZone({ zoneId: 'restroom-1', name: 'Restroom 1', type: 'restroom', densityScore: 30, center: { lat: 40.455, lng: -3.685 } }));
zones.set('food-1', makeZone({ zoneId: 'food-1', name: 'Food Court', type: 'food', densityScore: 45, center: { lat: 40.451, lng: -3.690 } }));
zones.set('exit-1', makeZone({ zoneId: 'exit-1', name: 'Exit NE', type: 'exit', densityScore: 10, center: { lat: 40.456, lng: -3.684 } }));

const queues = new Map<string, QueueState>();
queues.set('gate-a', makeQueue({ zoneId: 'gate-a', queueLength: 25, estimatedWaitMinutes: 8 }));
queues.set('gate-b', makeQueue({ zoneId: 'gate-b', queueLength: 5, estimatedWaitMinutes: 2 }));
queues.set('restroom-1', makeQueue({ zoneId: 'restroom-1', queueLength: 8, estimatedWaitMinutes: 3, zoneType: 'restroom' }));
queues.set('food-1', makeQueue({ zoneId: 'food-1', queueLength: 12, estimatedWaitMinutes: 5, zoneType: 'food' }));

const decision = computeDecision(zones, queues, [], userPos, false);
assert(decision.recommendedGate.recommendedZoneId === 'gate-b', 'Recommends Gate B (lower density + shorter queue)');
assert(decision.emergencyMode === false, 'Not in emergency mode');
assert(decision.reasoning.length > 0, 'Provides reasoning');

// Emergency mode decision
const emergencyDecision = computeDecision(zones, queues, [], userPos, true);
assert(emergencyDecision.emergencyMode === true, 'Emergency mode flag set');
assert(emergencyDecision.emergencyExits !== null, 'Emergency exits provided');
assert(emergencyDecision.emergencyExits!.recommendedZoneId === 'exit-1', 'Recommends nearest exit');

// ── Queue Prediction ────────────────────────────────────────────────
console.log('\n🧪 Queue Prediction Tests');

assert(computeEMA([10, 10, 10], 0.3) === 10, 'EMA of constant values = same value');
assert(computeEMA([5, 10, 15], 0.3) > 5 && computeEMA([5, 10, 15], 0.3) < 15, 'EMA of increasing values between min and max');
assert(computeVelocity([10, 12, 14, 16]) === 2, 'Velocity of linear increase = 2');
assert(determineTrend(2) === 'increasing', 'Positive velocity → increasing');
assert(determineTrend(-2) === 'decreasing', 'Negative velocity → decreasing');
assert(determineTrend(0) === 'stable', 'Zero velocity → stable');

const qPrediction = predictQueue(makeQueue({ queueLength: 10, history: [5, 7, 8, 9, 10], serviceRate: 3 }));
assert(qPrediction.currentWait > 0, 'Current wait is positive');
assert(qPrediction.trend === 'increasing', 'Increasing queue trend detected');
assert(qPrediction.confidence > 0, 'Confidence is positive');

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'═'.repeat(50)}\n`);

// Bypass TS node types requirement for Vercel builds
declare var process: any;
if (failed > 0) process.exit(1);
