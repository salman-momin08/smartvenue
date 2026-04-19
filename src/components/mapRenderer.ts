/**
 * SmartVenue — Map Renderer (Stability Mode)
 * Renders venue zones on Google Maps with density-based color overlays.
 * Uses Legacy Markers for maximum compatibility without requiring a Map ID.
 */

import { ZoneData, DensityCategory, LatLng, VenueConfig } from '../types.js';

declare const google: any;

// ── Density Colors ──────────────────────────────────────────────────
const DENSITY_COLORS: Record<DensityCategory, { fill: string; stroke: string; glow: string }> = {
  LOW: { fill: 'rgba(16, 185, 129, 0.35)', stroke: '#10b981', glow: '#10b98140' },
  MEDIUM: { fill: 'rgba(245, 158, 11, 0.35)', stroke: '#f59e0b', glow: '#f59e0b40' },
  HIGH: { fill: 'rgba(239, 68, 68, 0.35)', stroke: '#ef4444', glow: '#ef444440' },
  CRITICAL: { fill: 'rgba(220, 38, 38, 0.55)', stroke: '#ff0000', glow: '#ff000060' },
};

const ZONE_ICONS: Record<string, string> = {
  gate: '🚪', restroom: '🚻', food: '🍔', seating: '💺', exit: '🚨',
};

// ── Google Maps Renderer ────────────────────────────────────────────
let map: any = null;
const polygons = new Map<string, any>();
const markers = new Map<string, any>();
const infoWindows = new Map<string, any>();

export async function initGoogleMap(container: HTMLElement, config: VenueConfig): Promise<boolean> {
  try {
    const isSimulation = import.meta.env.VITE_APP_MODE === 'simulation';

    if (isSimulation || typeof google === 'undefined' || !google.maps) {
      console.info(isSimulation ? '[MapRenderer] Simulation mode — using local floorplan' : '[MapRenderer] Google Maps not available — using canvas fallback');
      initCanvasMap(container, config);
      return false;
    }

    map = new google.maps.Map(container, {
      center: config.center, 
      zoom: config.zoom,
      mapTypeId: 'satellite',
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8899aa' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2332' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
      ],
    });

    for (const zone of config.zones) {
      createZonePolygon(zone);
      createZoneMarker(zone);
    }
    return true;
  } catch (err) {
    console.warn('[MapRenderer] Google Maps init failed:', err);
    initCanvasMap(container, config);
    return false;
  }
}

function createZonePolygon(zone: ZoneData): void {
  if (!map) return;
  const colors = DENSITY_COLORS[zone.densityCategory];
  const polygon = new google.maps.Polygon({
    paths: zone.polygon, 
    map,
    fillColor: colors.fill, 
    fillOpacity: 0.6,
    strokeColor: colors.stroke, 
    strokeWeight: 2,
  });
  polygon.addListener('click', () => showZoneInfo(zone));
  polygons.set(zone.zoneId, polygon);
}

function createZoneMarker(zone: ZoneData): void {
  if (!map) return;
  
  const marker = new google.maps.Marker({
    position: zone.center,
    map,
    label: { text: ZONE_ICONS[zone.type] || '📍', fontSize: '18px' },
    title: zone.name,
  });

  const iw = new google.maps.InfoWindow({
    content: buildInfoContent(zone),
  });

  marker.addListener('click', () => {
    infoWindows.forEach(w => w.close());
    iw.open(map, marker);
  });
  
  markers.set(zone.zoneId, marker);
  infoWindows.set(zone.zoneId, iw);
}

function showZoneInfo(zone: ZoneData): void {
  const iw = infoWindows.get(zone.zoneId);
  const marker = markers.get(zone.zoneId);
  if (iw && marker) {
    infoWindows.forEach(w => w.close());
    iw.setContent(buildInfoContent(zone));
    iw.open(map, marker);
  }
}

function buildInfoContent(zone: ZoneData): string {
  const colors = DENSITY_COLORS[zone.densityCategory];
  const isOperator = (window as any).appState?.userRole === 'operator';
  
  return `<div style="color:#111;font-family:Inter,sans-serif;padding:8px;min-width:180px">
    <div style="font-weight:700;margin-bottom:6px;border-bottom:1px solid #eee;padding-bottom:4px">${zone.name}</div>
    <div style="margin-bottom:8px">
      <span style="color:${colors.stroke};font-weight:600">● ${zone.densityCategory}</span> — ${Math.round(zone.densityScore)}%<br/>
      Occupancy: <strong>${zone.currentOccupancy}</strong> / ${zone.capacity}
    </div>
    <div style="font-size:12px;color:#666;margin-bottom:10px">
      Loc: ${zone.detailedLocation || 'Not specified'}<br/>
      Area: ${zone.roomArea || 'N/A'}
    </div>
    ${isOperator ? `
      <button onclick="window.showOperatorEdit('${zone.zoneId}')" 
              style="width:100%;padding:6px;background:#0066ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:12px">
        Edit Room Details
      </button>
    ` : ''}
  </div>`;
}

export function updateZoneOnMap(zone: ZoneData): void {
  if (map && polygons.has(zone.zoneId)) {
    const colors = DENSITY_COLORS[zone.densityCategory];
    const poly = polygons.get(zone.zoneId);
    poly.setOptions({ fillColor: colors.fill, strokeColor: colors.stroke });
    const iw = infoWindows.get(zone.zoneId);
    if (iw) iw.setContent(buildInfoContent(zone));
  }
  if (canvasCtx) updateCanvasZone(zone);
}

export function updateAllZones(zones: Map<string, ZoneData>): void {
  for (const zone of zones.values()) {
    updateZoneOnMap(zone);
  }
  if (canvasCtx) renderCanvas(zones);
}

export function highlightEmergencyExits(zones: Map<string, ZoneData>, active: boolean): void {
  for (const zone of zones.values()) {
    if (zone.type === 'exit') {
      if (map && polygons.has(zone.zoneId)) {
        const poly = polygons.get(zone.zoneId);
        poly.setOptions({
          fillColor: active ? 'rgba(16,185,129,0.6)' : DENSITY_COLORS[zone.densityCategory].fill,
          strokeColor: active ? '#10b981' : DENSITY_COLORS[zone.densityCategory].stroke,
          strokeWeight: active ? 4 : 2,
        });
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// CANVAS FALLBACK RENDERER
// ════════════════════════════════════════════════════════════════════
let canvasCtx: CanvasRenderingContext2D | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let canvasConfig: VenueConfig | null = null;
let canvasZones: Map<string, ZoneData> = new Map();
let tooltipEl: HTMLDivElement | null = null;
let hoveredZone: string | null = null;

let backgroundImg: HTMLImageElement | null = null;

function initCanvasMap(container: HTMLElement, config: VenueConfig): void {
  container.innerHTML = '';
  container.style.position = 'relative';
  
  // Load floorplan for simulation background
  backgroundImg = new Image();
  backgroundImg.src = '/floorplan.png';
  backgroundImg.onload = () => {
    if (canvasCtx) renderCanvas(canvasZones);
  };
  backgroundImg.onerror = () => {
    console.warn('[MapRenderer] Floorplan failed to load, falling back to dark grid.');
    backgroundImg = null;
  };

  canvasEl = document.createElement('canvas');
  canvasEl.id = 'venue-canvas';
  canvasEl.style.width = '100%';
  canvasEl.style.height = '100%';
  canvasEl.style.borderRadius = '12px';
  container.appendChild(canvasEl);

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'canvas-tooltip';
  tooltipEl.style.cssText = 'position:absolute;display:none;background:rgba(10,14,26,0.95);color:#f9fafb;padding:10px 14px;border-radius:8px;font-size:13px;pointer-events:none;border:1px solid rgba(255,255,255,0.15);backdrop-filter:blur(10px);z-index:10;max-width:220px;';
  container.appendChild(tooltipEl);

  canvasConfig = config;
  const zones = new Map<string, ZoneData>();
  config.zones.forEach(z => zones.set(z.zoneId, z));
  canvasZones = zones;

  const resizeObserver = new ResizeObserver(() => {
    if (!canvasEl) return;
    canvasEl.width = canvasEl.clientWidth * window.devicePixelRatio;
    canvasEl.height = canvasEl.clientHeight * window.devicePixelRatio;
    canvasCtx = canvasEl.getContext('2d');
    if (canvasCtx) {
      canvasCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
      renderCanvas(canvasZones);
    }
  });
  resizeObserver.observe(canvasEl);

  canvasEl.addEventListener('mousemove', (e) => handleCanvasHover(e));
  canvasEl.addEventListener('mouseleave', () => { if (tooltipEl) tooltipEl.style.display = 'none'; hoveredZone = null; });
}

function latLngToCanvas(pos: LatLng, w: number, h: number): { x: number; y: number } {
  if (!canvasConfig) return { x: 0, y: 0 };
  const c = canvasConfig.center;
  const scale = Math.min(w, h) / 0.014;
  return {
    x: w / 2 + (pos.lng - c.lng) * scale,
    y: h / 2 - (pos.lat - c.lat) * scale,
  };
}

function renderCanvas(zones: Map<string, ZoneData>): void {
  if (!canvasCtx || !canvasEl) return;
  const ctx = canvasCtx;
  const w = canvasEl.clientWidth;
  const h = canvasEl.clientHeight;

  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, w, h);

  // Draw background floorplan (with safety check for 'broken' state)
  if (backgroundImg && backgroundImg.complete && backgroundImg.naturalWidth > 0) {
    ctx.globalAlpha = 0.4; // Subtle background
    ctx.drawImage(backgroundImg, 0, 0, w, h);
    ctx.globalAlpha = 1.0;
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i < w; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
  for (let i = 0; i < h; i += 30) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }

  for (const zone of zones.values()) {
    drawCanvasZone(ctx, zone, w, h);
  }
  canvasZones = zones;
}

function drawCanvasZone(ctx: CanvasRenderingContext2D, zone: ZoneData, w: number, h: number): void {
  const colors = DENSITY_COLORS[zone.densityCategory];
  const center = latLngToCanvas(zone.center, w, h);
  const radius = zone.type === 'seating' ? 28 : zone.type === 'gate' ? 22 : 18;
  const isHovered = hoveredZone === zone.zoneId;

  ctx.beginPath();
  ctx.arc(center.x, center.y, radius + (isHovered ? 8 : 4), 0, Math.PI * 2);
  const glow = ctx.createRadialGradient(center.x, center.y, radius * 0.5, center.x, center.y, radius + 10);
  glow.addColorStop(0, colors.glow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = center.x + radius * Math.cos(angle);
    const py = center.y + radius * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = isHovered ? '#fff' : colors.stroke;
  ctx.lineWidth = isHovered ? 2.5 : 1.5;
  ctx.stroke();

  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ZONE_ICONS[zone.type] || '📍', center.x, center.y - 2);
}

function handleCanvasHover(e: MouseEvent): void {
  if (!canvasEl || !canvasConfig || !tooltipEl) return;
  const rect = canvasEl.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const w = canvasEl.clientWidth;
  const h = canvasEl.clientHeight;

  let found = false;
  for (const zone of canvasZones.values()) {
    const pos = latLngToCanvas(zone.center, w, h);
    const radius = zone.type === 'seating' ? 28 : zone.type === 'gate' ? 22 : 18;
    const dist = Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2);
    if (dist <= radius + 5) {
      hoveredZone = zone.zoneId;
      tooltipEl.innerHTML = `<strong>${zone.name}</strong><br/>Density: ${zone.densityCategory} (${Math.round(zone.densityScore)}%)`;
      tooltipEl.style.display = 'block';
      tooltipEl.style.left = `${mx + 15}px`;
      tooltipEl.style.top = `${my - 10}px`;
      found = true;
      renderCanvas(canvasZones);
      break;
    }
  }
  if (!found && hoveredZone) {
    hoveredZone = null;
    tooltipEl.style.display = 'none';
    renderCanvas(canvasZones);
  }
}

function updateCanvasZone(zone: ZoneData): void {
  canvasZones.set(zone.zoneId, zone);
}
