/**
 * SmartVenue — Panel Renderer
 * Renders the left (recommendations) and right (queue intelligence) UI panels.
 */

import {
  NavigationDecision, QueuePrediction, Incident, ZoneData,
  QueueState, DensityCategory, UserRole,
} from '../types.js';
import { formatPrediction } from '../utils/queuePredictor.js';

// ── Density Badge Colors ────────────────────────────────────────────
const BADGE_CLASS: Record<DensityCategory, string> = {
  LOW: 'badge-low', MEDIUM: 'badge-medium', HIGH: 'badge-high', CRITICAL: 'badge-critical',
};

function densityBadge(cat: DensityCategory): string {
  return `<span class="density-badge ${BADGE_CLASS[cat]}">${cat}</span>`;
}

function escapeHtml(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Render Recommendation Card ──────────────────────────────────────
function renderRecommendationCard(
  icon: string, title: string, gateName: string, reason: string,
  score: number, alternatives: { name: string; score: number }[],
): string {
  const altHtml = alternatives.slice(0, 2).map(a =>
    `<div class="alt-item"><span class="alt-name">${escapeHtml(a.name)}</span><span class="alt-score">${a.score.toFixed(2)}</span></div>`
  ).join('');

  return `<div class="rec-card" role="region" aria-label="${title} recommendation">
    <div class="rec-header">
      <span class="rec-icon" aria-hidden="true">${icon}</span>
      <div class="rec-title-group">
        <h3 class="rec-title">${escapeHtml(title)}</h3>
        <span class="rec-gate">${escapeHtml(gateName)}</span>
      </div>
      <div class="rec-score" title="Decision Score (lower is better)">
        <span class="score-value">${score === Infinity ? '—' : score.toFixed(2)}</span>
        <span class="score-label">score</span>
      </div>
    </div>
    <p class="rec-reason">${escapeHtml(reason)}</p>
    ${altHtml ? `<div class="rec-alternatives"><span class="alt-label">Alternatives:</span>${altHtml}</div>` : ''}
  </div>`;
}

// ── Render Left Panel (Recommendations) ─────────────────────────────
export function renderRecommendationsPanel(
  container: HTMLElement,
  decision: NavigationDecision | null,
  incidents: Incident[],
  role: UserRole,
): void {
  if (!decision) {
    container.innerHTML = `<div class="panel-empty"><div class="loader"></div><p>Analyzing venue conditions…</p></div>`;
    return;
  }

  const activeIncidents = incidents.filter(i => i.active);

  let html = `<div class="panel-header">
    <h2 class="panel-title"><span class="pulse-dot ${decision.overallStatus === 'CRITICAL' ? 'pulse-red' : ''}"></span>Assistant Recommendations</h2>
    <div class="panel-status">${densityBadge(decision.overallStatus)}</div>
  </div>`;

  // Reasoning
  html += `<div class="reasoning-box" role="log" aria-label="Reasoning log">
    <div class="reasoning-title">🧠 Decision Reasoning</div>
    ${decision.reasoning.map(r => `<div class="reasoning-line">${escapeHtml(r)}</div>`).join('')}
  </div>`;

  // Emergency exits
  if (decision.emergencyMode && decision.emergencyExits) {
    html += renderRecommendationCard('🚨', 'Emergency Exit', decision.emergencyExits.recommendedGate,
      decision.emergencyExits.reason, decision.emergencyExits.score,
      decision.emergencyExits.alternatives);
  }

  // Gate recommendation
  html += renderRecommendationCard('🚪', 'Best Entry Gate', decision.recommendedGate.recommendedGate,
    decision.recommendedGate.reason, decision.recommendedGate.score,
    decision.recommendedGate.alternatives);

  // Restroom recommendation
  html += renderRecommendationCard('🚻', 'Nearest Restroom', decision.recommendedRestroom.recommendedGate,
    decision.recommendedRestroom.reason, decision.recommendedRestroom.score,
    decision.recommendedRestroom.alternatives);

  // Food recommendation
  html += renderRecommendationCard('🍔', 'Food Stall', decision.recommendedFood.recommendedGate,
    decision.recommendedFood.reason, decision.recommendedFood.score,
    decision.recommendedFood.alternatives);

  // Incidents
  if (activeIncidents.length > 0) {
    html += `<div class="incidents-section">
      <h3 class="incidents-title">⚠️ Active Incidents (${activeIncidents.length})</h3>
      ${activeIncidents.slice(0, 5).map(i => `<div class="incident-card incident-${i.severity}" role="alert">
        <span class="incident-type">${i.type.replace('_', ' ')}</span>
        <span class="incident-severity">${i.severity}</span>
        <p class="incident-desc">${escapeHtml(i.description)}</p>
      </div>`).join('')}
    </div>`;
  }

  container.innerHTML = html;
}

// ── Render Queue Card ───────────────────────────────────────────────
function renderQueueCard(queue: QueueState, prediction: QueuePrediction | undefined): string {
  const trendIcon = prediction ? (prediction.trend === 'increasing' ? '📈' : prediction.trend === 'decreasing' ? '📉' : '➡️') : '➡️';
  const waitClass = queue.estimatedWaitMinutes > 10 ? 'wait-high' : queue.estimatedWaitMinutes > 5 ? 'wait-medium' : 'wait-low';
  const typeIcon = queue.zoneType === 'gate' ? '🚪' : queue.zoneType === 'restroom' ? '🚻' : '🍔';

  let html = `<div class="queue-card" role="region" aria-label="Queue for ${queue.zoneName}">
    <div class="queue-header">
      <span class="queue-icon" aria-hidden="true">${typeIcon}</span>
      <span class="queue-name">${escapeHtml(queue.zoneName)}</span>
      <span class="queue-trend">${trendIcon}</span>
    </div>
    <div class="queue-metrics">
      <div class="metric">
        <span class="metric-value">${queue.queueLength}</span>
        <span class="metric-label">In Queue</span>
      </div>
      <div class="metric">
        <span class="metric-value ${waitClass}">~${queue.estimatedWaitMinutes}m</span>
        <span class="metric-label">Wait</span>
      </div>
      <div class="metric">
        <span class="metric-value">${queue.velocity > 0 ? '+' : ''}${queue.velocity.toFixed(1)}</span>
        <span class="metric-label">Velocity</span>
      </div>
    </div>`;

  if (prediction) {
    const confPct = Math.round(prediction.confidence * 100);
    html += `<div class="queue-prediction">
      <span class="pred-label">Predicted:</span>
      <span class="pred-value">~${prediction.predictedWait}min</span>
      <span class="pred-confidence">${confPct}% conf</span>
    </div>`;
  }

  html += `</div>`;
  return html;
}

// ── Render Right Panel (Queue Intelligence) ─────────────────────────
export function renderQueuePanel(
  container: HTMLElement,
  queues: Map<string, QueueState>,
  predictions: Map<string, QueuePrediction>,
): void {
  if (queues.size === 0) {
    container.innerHTML = `<div class="panel-empty"><div class="loader"></div><p>Loading queue data…</p></div>`;
    return;
  }

  const sorted = Array.from(queues.values()).sort((a, b) => b.queueLength - a.queueLength);

  // Aggregate stats
  const totalInQueue = sorted.reduce((s, q) => s + q.queueLength, 0);
  const avgWait = sorted.length > 0 ? Math.round(sorted.reduce((s, q) => s + q.estimatedWaitMinutes, 0) / sorted.length) : 0;
  const longestQueue = sorted[0];

  let html = `<div class="panel-header">
    <h2 class="panel-title">📊 Queue Intelligence</h2>
  </div>
  <div class="queue-summary">
    <div class="summary-stat">
      <span class="summary-value">${totalInQueue}</span>
      <span class="summary-label">Total Queued</span>
    </div>
    <div class="summary-stat">
      <span class="summary-value">~${avgWait}m</span>
      <span class="summary-label">Avg Wait</span>
    </div>
    <div class="summary-stat">
      <span class="summary-value">${longestQueue ? longestQueue.queueLength : 0}</span>
      <span class="summary-label">Longest</span>
    </div>
  </div>
  <div class="queue-list" role="list" aria-label="Queue status list">`;

  for (const queue of sorted) {
    html += renderQueueCard(queue, predictions.get(queue.zoneId));
  }

  html += `</div>`;
  container.innerHTML = html;
}

// ── Render Emergency Banner ─────────────────────────────────────────
export function renderEmergencyBanner(container: HTMLElement, active: boolean, message?: string): void {
  container.classList.toggle('emergency-active', active);
  if (active) {
    container.innerHTML = `<div class="emergency-content" role="alert" aria-live="assertive">
      <span class="emergency-icon">🚨</span>
      <span class="emergency-text">EMERGENCY MODE ACTIVATED${message ? ` — ${escapeHtml(message)}` : ''}</span>
      <span class="emergency-pulse"></span>
    </div>`;
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }
}

// ── Render Toolbar ──────────────────────────────────────────────────
/**
 * Renders the application toolbar with action buttons.
 * @param {HTMLElement} container The DOM element to render into
 * @param {UserRole} role Current user role
 * @param {boolean} highContrast High contrast mode active state
 * @param {boolean} emergencyMode Emergency mode active state
 * @param {boolean} aiLoading Loading state for the AI Consultant
 * @param {Function} onToggleContrast Callback to toggle contrast
 * @param {Function} onToggleEmergency Callback to toggle emergency mode
 * @param {Function} onAIConsult Callback to invoke Gemini AI
 */
export function renderToolbar(
  container: HTMLElement,
  role: UserRole,
  highContrast: boolean,
  emergencyMode: boolean,
  aiLoading: boolean,
  onToggleContrast: () => void,
  onToggleEmergency: () => void,
  onAIConsult: () => void,
): void {
  const operatorButtons = role === 'operator' ? `
      <button id="btn-role" class="toolbar-btn active" aria-label="Operator active" title="Operator privileges active" disabled>
        <span class="btn-icon">🔧</span>
        <span class="btn-text">Operator</span>
      </button>
      <button id="btn-emergency" class="toolbar-btn btn-emergency ${emergencyMode ? 'active' : ''}" aria-label="Toggle emergency mode" title="Emergency mode">
        <span class="btn-icon">🚨</span>
        <span class="btn-text">Emergency</span>
      </button>
  ` : '';

  container.innerHTML = `
    <div class="toolbar-left">
      <div class="toolbar-brand">
        <img src="/logo.png" alt="SmartVenue Official Logo" width="24" height="24" style="border-radius:4px;" onerror="this.style.display='none'">
        <span class="brand-icon" aria-hidden="true">🏟️</span>
        <span class="brand-name">SmartVenue</span>
        <span class="brand-tag">Assistant</span>
      </div>
    </div>
    <div class="toolbar-right">
      <button id="ai-consultant-btn" class="toolbar-btn ${aiLoading ? 'loading' : ''}" aria-label="Consult Gemini AI" ${aiLoading ? 'disabled' : ''}>
        <span class="btn-icon">${aiLoading ? '⏳' : '✨'}</span>
        <span class="btn-text">${aiLoading ? 'Thinking...' : 'AI Consultant'}</span>
      </button>
      ${operatorButtons}
      <button id="btn-contrast" class="toolbar-btn ${highContrast ? 'active' : ''}" aria-label="Toggle high contrast" title="High contrast mode">
        <span class="btn-icon">🌓</span>
        <span class="btn-text">Contrast</span>
      </button>
      <div class="toolbar-status">
        <span class="status-dot ${emergencyMode ? 'status-red' : 'status-green'}"></span>
        <span class="status-text">${emergencyMode ? 'EMERGENCY' : 'LIVE'}</span>
      </div>
    </div>`;

  document.getElementById('btn-contrast')?.addEventListener('click', onToggleContrast);
  document.getElementById('btn-emergency')?.addEventListener('click', onToggleEmergency);
  document.getElementById('ai-consultant-btn')?.addEventListener('click', onAIConsult);
}
