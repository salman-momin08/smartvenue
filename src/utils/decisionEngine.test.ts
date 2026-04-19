import { describe, it, expect } from 'vitest';
import { computeDecision, classifyDensity } from './decisionEngine.js';
import { ZoneData, QueueState, AppState } from '../types.js';

describe('Decision Engine Logic', () => {
  it('should correctly classify density categories', () => {
    expect(classifyDensity(10)).toBe('LOW');
    expect(classifyDensity(45)).toBe('MEDIUM');
    expect(classifyDensity(75)).toBe('HIGH');
    expect(classifyDensity(95)).toBe('CRITICAL');
  });

  it('should compute valid navigation decisions', () => {
    const zones = new Map<string, ZoneData>();
    zones.set('gate1', {
      zoneId: 'gate1', name: 'Gate 1', type: 'gate',
      densityScore: 20, densityCategory: 'LOW',
      center: { lat: 0, lng: 0 }, polygon: [],
      capacity: 1000, currentOccupancy: 200, isOpen: true,
      timestamp: Date.now()
    });

    const queues = new Map<string, QueueState>();
    queues.set('gate1', {
      zoneId: 'gate1', zoneName: 'Gate 1', zoneType: 'gate',
      queueLength: 5, estimatedWaitMinutes: 2, serviceRate: 2,
      velocity: 0, history: [], timestamp: Date.now()
    });

    const state: Partial<AppState> = {
      zones,
      queues,
      userPosition: { lat: 0.001, lng: 0.001 }
    };

    const decision = computeDecision(state as AppState);
    
    expect(decision).toBeDefined();
    expect(decision.recommendedGate.recommendedZoneId).toBe('gate1');
    expect(decision.emergencyMode).toBe(false);
  });
});
