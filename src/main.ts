/**
 * SmartVenue Assistant — Main Entry Point
 * Initializes all modules and starts the real-time simulation loop.
 */

import { AppState, UserRole, ZoneData, QueueState, Incident, LatLng } from './types.js';
import { computeDecision } from './assistant/decisionEngine.js';
import { predictAllQueues } from './assistant/queuePredictor.js';
import { monitorIncidents, shouldActivateEmergency, triggerEmergency } from './assistant/incidentMonitor.js';
import { createVenueConfig, createInitialQueues, startSimulation } from './data/simulationEngine.js';
import { initGoogleMap, updateAllZones, highlightEmergencyExits } from './ui/mapRenderer.js';
import { renderRecommendationsPanel, renderQueuePanel, renderEmergencyBanner, renderToolbar } from './ui/panelRenderer.js';
import { initNotifications, notifyNewIncidents, notifyRouteChange } from './ui/notificationService.js';
import { initFirebase, writeRoutingSuggestion, isConnected, writeIncident } from './firebase/firebaseService.js';
import { hasPermission, validateRole } from './security/validation.js';

// ── Application State ───────────────────────────────────────────────
const state: AppState = {
  zones: new Map(),
  queues: new Map(),
  incidents: [],
  currentDecision: null,
  predictions: new Map(),
  emergencyMode: false,
  userRole: 'attendee',
  highContrastMode: false,
  userPosition: { lat: 40.4531, lng: -3.6884 },
};

// ── DOM Elements ────────────────────────────────────────────────────
let leftPanel: HTMLElement;
let mapContainer: HTMLElement;
let rightPanel: HTMLElement;
let emergencyBanner: HTMLElement;
let toolbar: HTMLElement;
let stopSimulation: (() => void) | null = null;

// ── Initialize ──────────────────────────────────────────────────────
function init(): void {
  leftPanel = document.getElementById('left-panel')!;
  mapContainer = document.getElementById('map-container')!;
  rightPanel = document.getElementById('right-panel')!;
  emergencyBanner = document.getElementById('emergency-banner')!;
  toolbar = document.getElementById('toolbar')!;

  if (!leftPanel || !mapContainer || !rightPanel || !emergencyBanner || !toolbar) {
    console.error('[SmartVenue] Missing DOM elements');
    return;
  }

  // Try Firebase init (works if config is available)
  tryFirebaseInit();

  // Create venue
  const config = createVenueConfig();
  config.zones.forEach(z => state.zones.set(z.zoneId, z));
  state.queues = createInitialQueues(config.zones);

  // Init map
  initGoogleMap(mapContainer, config);

  // Render toolbar
  updateToolbar();

  // Render initial state
  updateUI();

  // Start simulation loop (3 second intervals)
  stopSimulation = startSimulation(state.zones, state.queues, onSimulationUpdate, 3000);

  // Keyboard navigation
  setupKeyboardNav();

  // Initialize notifications on first user interaction to comply with browser gesture policies
  const enableNotifications = () => {
    initNotifications();
    document.removeEventListener('click', enableNotifications);
  };
  document.addEventListener('click', enableNotifications);

  console.info('[SmartVenue] ✅ Initialized — simulation running');
  console.info(`[SmartVenue] Firebase: ${isConnected() ? 'Connected' : 'Simulation mode'}`);
}

// ── Try Firebase Initialization ─────────────────────────────────────
function tryFirebaseInit(): void {
  // Check for config in global scope (set by user in a separate script)
  const win = window as any;
  if (win.FIREBASE_CONFIG) {
    initFirebase(win.FIREBASE_CONFIG);
  } else {
    console.info('[SmartVenue] No Firebase config found — running in simulation mode');
  }
}

// ── Simulation Update Handler ───────────────────────────────────────
function onSimulationUpdate(zones: Map<string, ZoneData>, queues: Map<string, QueueState>): void {
  state.zones = zones;
  state.queues = queues;

  // Monitor incidents
  state.incidents = monitorIncidents(zones, state.incidents);
  
  // Push real-time OS notifications for incidents
  notifyNewIncidents(state.incidents);

  // Check emergency
  const shouldEmergency = shouldActivateEmergency(state.incidents);
  if (shouldEmergency && !state.emergencyMode) {
    state.emergencyMode = true;
  }

  // Compute predictions
  state.predictions = predictAllQueues(queues);

  // Compute decision
  state.currentDecision = computeDecision(
    zones, queues, state.incidents,
    state.userPosition, state.emergencyMode,
  );

  // Notify user if their optimal route changes significantly
  if (state.currentDecision && !state.emergencyMode) {
    notifyRouteChange(
      state.currentDecision.recommendedGate.recommendedGate,
      state.currentDecision.recommendedGate.reason
    );
  }

  // Push routing to Firebase
  if (isConnected() && state.currentDecision) {
    const d = state.currentDecision;
    writeRoutingSuggestion(d.recommendedGate.recommendedGate, d.recommendedGate.reason, d.recommendedGate.score);
    // Write new incidents
    state.incidents.filter(i => i.active).forEach(i => writeIncident(i));
  }

  // Update UI
  updateUI();
}

// ── Update All UI ───────────────────────────────────────────────────
function updateUI(): void {
  // Update map
  updateAllZones(state.zones);
  highlightEmergencyExits(state.zones, state.emergencyMode);

  // Update panels
  renderRecommendationsPanel(leftPanel, state.currentDecision, state.incidents, state.userRole);
  renderQueuePanel(rightPanel, state.queues, state.predictions);

  // Emergency banner
  renderEmergencyBanner(emergencyBanner, state.emergencyMode,
    state.emergencyMode ? 'Follow nearest emergency exit — avoid high-density zones' : undefined);
}

// ── Toolbar Handlers ────────────────────────────────────────────────
function updateToolbar(): void {
  renderToolbar(toolbar, state.userRole, state.highContrastMode, state.emergencyMode,
    toggleRole, toggleContrast, toggleEmergency);
}

function toggleRole(): void {
  state.userRole = state.userRole === 'attendee' ? 'operator' : 'attendee';
  updateToolbar();
  updateUI();
}

function toggleContrast(): void {
  state.highContrastMode = !state.highContrastMode;
  document.documentElement.classList.toggle('high-contrast', state.highContrastMode);
  updateToolbar();
}

function toggleEmergency(): void {
  if (!hasPermission(state.userRole, 'canTriggerEmergency')) {
    showToast('⚠️ Only operators can trigger emergency mode', 'warning');
    return;
  }
  state.emergencyMode = !state.emergencyMode;
  if (state.emergencyMode) {
    const incident = triggerEmergency('venue-wide', 'Venue', 'Manual emergency activation by operator');
    state.incidents.push(incident);
  } else {
    // Resolve all emergency incidents
    state.incidents = state.incidents.map(i =>
      i.type === 'emergency' ? { ...i, active: false } : i
    );
  }
  updateToolbar();
  updateUI();
}

// ── Toast Notification ──────────────────────────────────────────────
function showToast(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Keyboard Navigation ─────────────────────────────────────────────
function setupKeyboardNav(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Tab navigation already works natively
    // Add custom shortcuts
    if (e.altKey) {
      switch (e.key) {
        case 'e':
          e.preventDefault();
          if (hasPermission(state.userRole, 'canTriggerEmergency')) toggleEmergency();
          break;
        case 'r':
          e.preventDefault();
          toggleRole();
          break;
        case 'c':
          e.preventDefault();
          toggleContrast();
          break;
      }
    }
  });
}

// ── Boot ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
