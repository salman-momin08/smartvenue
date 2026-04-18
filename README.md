# SmartVenue Assistant

A lightweight smart assistant web application designed to improve the attendee experience inside large-scale sporting venues by intelligently guiding users toward faster routes, shorter queues, and safer movement decisions using real-time simulated venue intelligence.

## Chosen Vertical
**Smart Sporting Venue Assistant**

This project focuses on the unique challenges of crowd management and navigation within massive sporting stadiums, arenas, and complexes.

## Assistant Logic Workflow

The SmartVenue Assistant operates on a real-time loop, analyzing conditions every 3 seconds to provide optimal guidance:

1. **Data Ingestion:** The `simulationEngine` generates real-time data for venue density, queue lengths, and incident triggers.
2. **Monitoring & Prediction:** 
   - `incidentMonitor` checks for crowd spikes, critical capacity overloads, and triggers active alerts.
   - `queuePredictor` analyzes historical wait times using an Exponential Moving Average (EMA) and velocity trends to forecast future queue states.
3. **Decision Computation:** The `decisionEngine` evaluates all available zones (gates, restrooms, food stalls, exits).
4. **Output:** The assistant recommends the optimal zone for each category, rendering the reasoning to the user interface and overlaying current density mapping on the venue.

## Decision Scoring Model

The `decisionEngine` determines the best recommendation by calculating a score for each zone. **The lower the score, the better the recommendation.**

```text
score = (distance_weight × distance_factor) 
      + (queue_weight × queue_factor) 
      + (density_weight × density_factor)
      + incident_penalty
```

* **Distance Factor:** Haversine distance from the user's current location to the zone, normalized.
* **Queue Factor:** Normalized expected wait time based on queue length and service rate.
* **Density Factor:** Normalized density score (0-100%).
* **Incident Penalty:** Adds severe penalties if a zone has active incidents (e.g., +1.0 for critical incidents, rendering it highly unlikely to be recommended).
* **Emergency Mode Weights:** If an emergency is triggered, distance to safety is prioritized heavily over queue and density factors.

## Google Services Used

1. **Google Maps JavaScript API (via CDN):** Used to render the actual venue context and draw dynamic, colored polygons representing the zones. (Note: The application falls back to a custom Canvas renderer if the API key is not provided, ensuring the demo always works).
2. **Firebase Firestore (via CDN):** Used to store live queue states, density snapshots, active incidents, and the engine's routing suggestions in real-time.

## Security Considerations

* **No Bundled Keys:** No API keys are committed to the repository (`.env.example` is provided).
* **Input Validation:** A custom `validation.ts` module sanitizes all strings against XSS, validates numbers/coordinates, and enforces strict regex on IDs.
* **Role-Based Access Control (RBAC):** Simulated authentication logic determines permissions based on `attendee` vs. `operator` roles.
* **Firestore Sanitization:** Data pushed to Firestore is explicitly sanitized to prevent injection of unexpected schema structures.
* **Rate Limiting:** A lightweight in-memory rate limiter prevents abuse of high-frequency actions.

## Assumptions Made

* **Venue Layout:** The simulation assumes a generic hexagonal stadium layout located in Madrid.
* **Movement Tracking:** Assumes user location is static or provided by a separate GPS/Beacon system (hardcoded for the demo).
* **Service Rates:** Assumes queue service rates are relatively stable and measurable (simulated as people-served-per-minute).
* **Connectivity:** Assumes attendees have a stable internet connection, though Firebase local caching (if enabled) could mitigate temporary drops.

## Architecture Overview

The repository is built with Vanilla TypeScript and minimal HTML/CSS to stay strictly under the 1MB limit without relying on heavy frontend frameworks or bundlers.

* `src/assistant/`: Core intelligence (Decision Engine, Queue Predictor, Incident Monitor).
* `src/data/`: `simulationEngine.ts` drives the real-time mock data.
* `src/firebase/`: `firebaseService.ts` handles Firestore interactions with a graceful simulation fallback.
* `src/security/`: Validation and role control.
* `src/ui/`: `mapRenderer.ts` (Google Maps / Canvas) and `panelRenderer.ts` (DOM updates).
* `styles/main.css`: Fully custom, zero-dependency CSS implementing a premium dark-mode aesthetic.

## How to Run Locally

### 1. Requirements
* Node.js (v18+)
* npm

### 2. Setup
Clone the repository and install the development dependencies (TypeScript and local server).

```bash
npm install
```

### 3. Run the Application
Start the TypeScript compiler in watch mode and launch the local web server concurrently:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### 4. Run Tests
Execute the decision engine and queue prediction test suite:

```bash
npm run test
```

### 5. Optional: Configure Google Services
By default, the application runs perfectly in **Simulation Mode** using a custom Canvas map renderer and local state. To use real services:

1. Copy `.env.example` to `.env`.
2. Edit `index.html` and uncomment the Google Maps and Firebase script tags.
3. Insert your actual API keys in `index.html` (do not commit these changes).
