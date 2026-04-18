import { describe, it, expect } from 'vitest';
import { computeDecision, classifyDensity, _testing } from '../utils/decisionEngine.js';
import { predictQueue, _testing as qTesting } from '../utils/queuePredictor.js';
import { ZoneData, QueueState, Incident, LatLng } from '../types.js';

const { scoreZone, haversineDistance, DEFAULT_WEIGHTS } = _testing;
const { computeEMA, computeVelocity, determineTrend } = qTesting;

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

describe('SmartVenue Decision Engine', () => {
  describe('Density Classification', () => {
    it('correctly classifies density scores', () => {
      expect(classifyDensity(10)).toBe('LOW');
      expect(classifyDensity(49)).toBe('MEDIUM');
      expect(classifyDensity(50)).toBe('HIGH');
      expect(classifyDensity(75)).toBe('CRITICAL');
    });
  });

  describe('Distance Calculation', () => {
    it('calculates proper haversine distance', () => {
      const dist = haversineDistance({ lat: 40.45, lng: -3.69 }, { lat: 40.45, lng: -3.69 });
      expect(dist).toBeLessThan(0.01);
    });
  });

  describe('Zone Scoring', () => {
    const userPos: LatLng = { lat: 40.453, lng: -3.688 };

    it('scores low density better than high density', () => {
      const lowDensityZone = makeZone({ zoneId: 'gate-b', densityScore: 15 });
      const highDensityZone = makeZone({ zoneId: 'gate-a', densityScore: 85 });
      const scoreLow = scoreZone(lowDensityZone, undefined, userPos, DEFAULT_WEIGHTS, []);
      const scoreHigh = scoreZone(highDensityZone, undefined, userPos, DEFAULT_WEIGHTS, []);
      expect(scoreLow).toBeLessThan(scoreHigh);
    });

    it('returns infinity for closed zones', () => {
      const closedZone = makeZone({ isOpen: false });
      expect(scoreZone(closedZone, undefined, userPos, DEFAULT_WEIGHTS, [])).toBe(Infinity);
    });
  });

  describe('Queue Prediction', () => {
    it('calculates correct velocity and trend', () => {
      expect(computeVelocity([10, 12, 14, 16])).toBe(2);
      expect(determineTrend(2)).toBe('increasing');
    });
  });
});
