/**
 * SmartVenue — Queue Prediction Engine
 * 
 * Uses exponential moving average (EMA) and velocity trend analysis
 * to predict future queue wait times. Predictions are stored and
 * can be pushed to Firestore.
 */

import { QueueState, QueuePrediction } from '../types.js';

// ── Configuration ───────────────────────────────────────────────────
const EMA_ALPHA = 0.3;          // smoothing factor (higher = more weight to recent)
const PREDICTION_HORIZON = 5;   // predict N minutes ahead
const MIN_HISTORY = 3;          // minimum data points for prediction
const MAX_HISTORY = 20;         // keep last N data points

// ── Exponential Moving Average ──────────────────────────────────────
function computeEMA(values: number[], alpha: number): number {
  if (values.length === 0) return 0;
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
  }
  return ema;
}

// ── Velocity (rate of change) ───────────────────────────────────────
function computeVelocity(history: number[]): number {
  if (history.length < 2) return 0;
  const recent = history.slice(-5);
  let totalDelta = 0;
  for (let i = 1; i < recent.length; i++) {
    totalDelta += recent[i] - recent[i - 1];
  }
  return totalDelta / (recent.length - 1);
}

// ── Determine Trend ─────────────────────────────────────────────────
function determineTrend(velocity: number): 'increasing' | 'decreasing' | 'stable' {
  if (velocity > 0.5) return 'increasing';
  if (velocity < -0.5) return 'decreasing';
  return 'stable';
}

// ── Confidence Score ────────────────────────────────────────────────
function computeConfidence(historyLength: number): number {
  // More data = higher confidence, max at 0.95
  return Math.min(0.95, Math.max(0.2, historyLength / MAX_HISTORY));
}

// ── Predict Future Queue ────────────────────────────────────────────
export function predictQueue(queue: QueueState): QueuePrediction {
  const history = queue.history;
  const currentLength = queue.queueLength;

  // EMA-smoothed queue length
  const smoothedLength = history.length >= MIN_HISTORY
    ? computeEMA(history, EMA_ALPHA)
    : currentLength;

  // Velocity trend
  const velocity = computeVelocity(history);
  const trend = determineTrend(velocity);

  // Predicted queue length in PREDICTION_HORIZON minutes
  let predictedLength = smoothedLength + velocity * PREDICTION_HORIZON;
  predictedLength = Math.max(0, Math.round(predictedLength));

  // Convert to wait time using service rate
  const serviceRate = queue.serviceRate > 0 ? queue.serviceRate : 1;
  const currentWait = Math.round(currentLength / serviceRate);
  const predictedWait = Math.round(predictedLength / serviceRate);

  return {
    zoneId: queue.zoneId,
    currentWait: Math.max(0, currentWait),
    predictedWait: Math.max(0, predictedWait),
    trend,
    confidence: computeConfidence(history.length),
    timestamp: Date.now(),
  };
}

// ── Batch Predict All Queues ────────────────────────────────────────
export function predictAllQueues(
  queues: Map<string, QueueState>
): Map<string, QueuePrediction> {
  const predictions = new Map<string, QueuePrediction>();
  for (const [zoneId, queue] of queues) {
    predictions.set(zoneId, predictQueue(queue));
  }
  return predictions;
}

// ── Update Queue History ────────────────────────────────────────────
export function updateQueueHistory(queue: QueueState, newLength: number): QueueState {
  const history = [...queue.history, newLength].slice(-MAX_HISTORY);
  const velocity = computeVelocity(history);
  const serviceRate = queue.serviceRate > 0 ? queue.serviceRate : 1;

  return {
    ...queue,
    queueLength: newLength,
    estimatedWaitMinutes: Math.max(0, Math.round(newLength / serviceRate)),
    velocity,
    history,
    timestamp: Date.now(),
  };
}

// ── Format Prediction for Display ───────────────────────────────────
export function formatPrediction(prediction: QueuePrediction): string {
  const trendIcon =
    prediction.trend === 'increasing' ? '📈' :
    prediction.trend === 'decreasing' ? '📉' : '➡️';

  const confidence = Math.round(prediction.confidence * 100);

  return `${trendIcon} Current: ~${prediction.currentWait}min | ` +
    `Predicted: ~${prediction.predictedWait}min (${confidence}% confidence)`;
}

// ── Exported for testing ────────────────────────────────────────────
export const _testing = {
  computeEMA,
  computeVelocity,
  determineTrend,
  computeConfidence,
};
