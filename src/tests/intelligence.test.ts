import { describe, it, expect } from 'vitest';
import { predictQueue, computeEMA, determineTrend } from './queuePredictor.js';
import { monitorIncidents, shouldActivateEmergency } from './incidentMonitor.js';
import { ZoneData, QueueState, Incident } from '../types.js';

describe('SmartVenue Intelligence Audit', () => {
  
  describe('Queue Predictor', () => {
    it('should compute correct EMA', () => {
      const data = [10, 20, 30];
      const ema = computeEMA(data);
      expect(ema).toBeGreaterThan(10);
      expect(ema).toBeLessThan(30);
    });

    it('should identify increasing trends', () => {
      const history = [5, 10, 15, 20];
      const prediction = predictQueue({ 
        zoneId: 'z1', history, queueLength: 20, serviceRate: 2 
      } as QueueState);
      expect(prediction.trend).toBe('increasing');
    });
  });

  describe('Incident Monitor', () => {
    it('should detect critical overload', () => {
      const zones = new Map<string, ZoneData>();
      zones.set('z1', { 
        zoneId: 'z1', name: 'Stage', densityScore: 95, 
        capacity: 100, isOpen: true 
      } as ZoneData);
      
      const incidents = monitorIncidents(zones, []);
      expect(incidents.some(i => i.type === 'zone_closure')).toBe(true);
      expect(incidents.find(i => i.type === 'zone_closure')?.severity).toBe('high');
    });

    it('should recognize emergency state', () => {
      const incidents: Incident[] = [{
        incidentId: '1', type: 'emergency', severity: 'critical', 
        active: true, zoneId: 'any', zoneName: 'any', 
        description: 'FIRE', timestamp: Date.now()
      }];
      expect(shouldActivateEmergency(incidents)).toBe(true);
    });
  });
});
