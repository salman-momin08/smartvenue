/**
 * SmartVenue Assistant — Main Entry Point
 * Initializes all modules and starts the real-time simulation loop.
 */

import { AppState, UserRole, ZoneData, QueueState, Incident, LatLng } from './types.js';
import { computeDecision } from './utils/decisionEngine.js';
import { predictAllQueues } from './utils/queuePredictor.js';
import { monitorIncidents, shouldActivateEmergency, triggerEmergency } from './utils/incidentMonitor.js';
import { createVenueConfig, createInitialQueues, startSimulation } from './services/simulationEngine.js';
import { initGoogleMap, updateAllZones, highlightEmergencyExits } from './components/mapRenderer.js';
import { renderRecommendationsPanel, renderQueuePanel, renderEmergencyBanner, renderToolbar } from './components/panelRenderer.js';
import { initNotifications, notifyNewIncidents, notifyRouteChange } from './components/notificationService.js';
import { initFirebase, writeRoutingSuggestion, isConnected, writeIncident } from './services/firebaseService.js';
import { GoogleServiceProvider } from './services/GoogleServiceProvider.js';
import { hasPermission, validateRole } from './utils/validation.js';
import { initErrorBoundary } from './components/errorBoundary.js';

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
  aiLoading: false,
};

// ── DOM Elements ────────────────────────────────────────────────────
let leftPanel: HTMLElement;
let mapContainer: HTMLElement;
let rightPanel: HTMLElement;
let emergencyBanner: HTMLElement;
let toolbar: HTMLElement;
let stopSimulation: (() => void) | null = null;

// ── Initialize ──────────────────────────────────────────────────────
async function init(): Promise<void> {
  // Setup global error boundary first
  initErrorBoundary();

  leftPanel = document.getElementById('left-panel')!;
  mapContainer = document.getElementById('map-container')!;
  rightPanel = document.getElementById('right-panel')!;
  emergencyBanner = document.getElementById('emergency-banner')!;
  toolbar = document.getElementById('toolbar')!;

  if (!leftPanel || !mapContainer || !rightPanel || !emergencyBanner || !toolbar) {
    console.error('[SmartVenue] Missing DOM elements');
    return;
  }

  // Try Firebase init (works if config is available) and wait for Auth
  await tryFirebaseInit();

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
/**
 * Initializes Firebase securely via GoogleServiceProvider and environment variables.
 * Falls back to simulation mode if no configuration is found.
 */
async function tryFirebaseInit(): Promise<void> {
  let isConnectedToFirebase = false;

  // Check for config in Vite env or global scope
  if (import.meta.env?.VITE_FIREBASE_API_KEY) {
    const config = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    GoogleServiceProvider.getInstance().init(config);
    initFirebase(config);
    isConnectedToFirebase = true;
  } else {
    console.info('[SmartVenue] No Firebase config found — running in simulation mode');
    // Init provider anyway so Gemini can work independently
    GoogleServiceProvider.getInstance().init({});
  }

  // Perform Role Check
  const provider = GoogleServiceProvider.getInstance();
  const user = await provider.signInAnonymous();
  
  if (user && isConnectedToFirebase) {
    const isAdmin = await provider.checkAdminStatus(user.uid);
    state.userRole = isAdmin ? 'operator' : 'attendee';
    console.info(`[Auth] User ${user.uid} authenticated as ${state.userRole.toUpperCase()}.`);
  } else {
    // For local simulation without Firebase DB, we'll force attendee, 
    // but allow the developer to change DEFAULT_ROLE in .env if they really want.
    const devRole = import.meta.env?.VITE_DEFAULT_ROLE;
    state.userRole = (devRole === 'operator') ? 'operator' : 'attendee';
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
  renderToolbar(toolbar, state.userRole, state.highContrastMode, state.emergencyMode, state.aiLoading,
    toggleContrast, toggleEmergency, handleAIConsult);
}

/**
 * Operator Feature: Show Edit Modal for Room Details
 */
(window as any).showOperatorEdit = (zoneId: string) => {
  const zone = state.zones.get(zoneId);
  if (!zone) return;

  const modal = document.createElement('div');
  modal.className = 'operator-modal-overlay';
  modal.innerHTML = `
    <div class="operator-modal">
      <h3>Edit Room Details: ${zone.name}</h3>
      <div class="field">
        <label>Detailed Location</label>
        <input type="text" id="edit-loc" value="${zone.detailedLocation || ''}" placeholder="e.g. Level 2, Room B">
      </div>
      <div class="field">
        <label>Room Area</label>
        <input type="text" id="edit-area" value="${zone.roomArea || ''}" placeholder="e.g. 450m²">
      </div>
      <div class="modal-actions">
        <button id="cancel-edit" class="secondary">Cancel</button>
        <button id="save-edit" class="primary">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('cancel-edit')?.addEventListener('click', () => modal.remove());
  document.getElementById('save-edit')?.addEventListener('click', async () => {
    const loc = (document.getElementById('edit-loc') as HTMLInputElement).value;
    const area = (document.getElementById('edit-area') as HTMLInputElement).value;
    
    // Update local state
    zone.detailedLocation = loc;
    zone.roomArea = area;
    
    // Update live Firestore if connected
    if (import.meta.env.VITE_APP_MODE === 'live') {
      const { writeZoneData } = await import('./services/firebaseService.js');
      await writeZoneData(zone);
    }
    
    // Refresh UI
    const { updateZoneOnMap } = await import('./components/mapRenderer.js');
    updateZoneOnMap(zone);
    modal.remove();
  });
};

/**
 * Handle AI Consultation Request
 * Invokes the Gemini SDK via GoogleServiceProvider and updates the UI.
 * Prevents multiple concurrent requests by checking the aiLoading state.
 */
async function handleAIConsult(): Promise<void> {
  if (state.aiLoading) return;
  state.aiLoading = true;
  updateToolbar();

  const provider = GoogleServiceProvider.getInstance();
  const advice = await provider.getGeminiConsultantAdvice("Championship Sporting Event");
  
  state.aiLoading = false;
  updateToolbar();
  
  // Show result in a toast instead of standard alert for better UX
  showToast(`🤖 AI Consultant:\n${advice}`, 'info');
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
  // allow newlines in toasts
  toast.style.whiteSpace = 'pre-wrap';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, type === 'info' ? 8000 : 3000); // keep info toasts longer since AI responses are long
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
          // Role toggle removed for security.
          e.preventDefault();
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
