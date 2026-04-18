/**
 * SmartVenue — Incident Monitor
 * Monitors venue state for anomalies and triggers incidents.
 */

import { ZoneData, Incident, IncidentType, IncidentSeverity } from '../types.js';
import { classifyDensity } from './decisionEngine.js';

const CROWD_SPIKE_THRESHOLD = 20;
const CRITICAL_DENSITY_THRESHOLD = 80;
const AUTO_RESOLVE_DENSITY = 40;
const MAX_INCIDENTS = 50;
const previousDensities = new Map<string, number>();
let incidentCounter = 0;

function generateIncidentId(): string {
  return `INC-${Date.now()}-${++incidentCounter}`;
}

function severityFromDensity(density: number): IncidentSeverity {
  if (density >= 90) return 'critical';
  if (density >= 75) return 'high';
  if (density >= 50) return 'medium';
  return 'low';
}

function detectCrowdSpike(zone: ZoneData): Incident | null {
  const prev = previousDensities.get(zone.zoneId) ?? zone.densityScore;
  const delta = zone.densityScore - prev;
  previousDensities.set(zone.zoneId, zone.densityScore);
  if (delta >= CROWD_SPIKE_THRESHOLD && zone.densityScore >= 50) {
    return {
      incidentId: generateIncidentId(), zoneId: zone.zoneId, zoneName: zone.name,
      type: 'crowd_spike', severity: severityFromDensity(zone.densityScore), active: true,
      description: `Crowd spike in ${zone.name}: density surged by ${Math.round(delta)}% to ${Math.round(zone.densityScore)}%`,
      timestamp: Date.now(),
    };
  }
  return null;
}

function detectCriticalOverload(zone: ZoneData): Incident | null {
  if (zone.densityScore >= CRITICAL_DENSITY_THRESHOLD) {
    return {
      incidentId: generateIncidentId(), zoneId: zone.zoneId, zoneName: zone.name,
      type: 'zone_closure', severity: 'high', active: true,
      description: `${zone.name} at critical capacity (${Math.round(zone.densityScore)}%)`,
      timestamp: Date.now(),
    };
  }
  return null;
}

function autoResolve(incidents: Incident[], zones: Map<string, ZoneData>): Incident[] {
  return incidents.map((inc) => {
    if (!inc.active || inc.type === 'emergency') return inc;
    const zone = zones.get(inc.zoneId);
    if (zone && zone.densityScore < AUTO_RESOLVE_DENSITY) {
      return { ...inc, active: false, description: inc.description + ' [AUTO-RESOLVED]' };
    }
    return inc;
  });
}

export function monitorIncidents(zones: Map<string, ZoneData>, existing: Incident[]): Incident[] {
  let incidents = autoResolve([...existing], zones);
  for (const zone of zones.values()) {
    if (!zone.isOpen) continue;
    const spike = detectCrowdSpike(zone);
    if (spike) incidents.push(spike);
    const hasActive = incidents.some(i => i.zoneId === zone.zoneId && i.type === 'zone_closure' && i.active);
    if (!hasActive) {
      const overload = detectCriticalOverload(zone);
      if (overload) incidents.push(overload);
    }
  }
  if (incidents.length > MAX_INCIDENTS) {
    const active = incidents.filter(i => i.active);
    const resolved = incidents.filter(i => !i.active);
    incidents = [...active, ...resolved.slice(-(MAX_INCIDENTS - active.length))];
  }
  return incidents;
}

export function triggerEmergency(zoneId: string, zoneName: string, description: string): Incident {
  return {
    incidentId: generateIncidentId(), zoneId, zoneName, type: 'emergency',
    severity: 'critical', active: true, description: `🚨 EMERGENCY: ${description}`, timestamp: Date.now(),
  };
}

export function resolveIncident(incidents: Incident[], incidentId: string): Incident[] {
  return incidents.map(i => i.incidentId === incidentId ? { ...i, active: false, description: i.description + ' [RESOLVED]' } : i);
}

export function shouldActivateEmergency(incidents: Incident[]): boolean {
  return incidents.some(i => i.active && i.type === 'emergency' && i.severity === 'critical');
}
