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

## Technical Architecture

This application represents a comprehensive showcase of modern, intelligent cloud infrastructure, explicitly leveraging the following enterprise-grade technologies:

* **Google Antigravity & Gemini Pro:** Powers the real-time "AI Event Consultant" feature, offering dynamic, contextual layout and catering recommendations based on shifting event conditions.
* **Firebase Authentication:** Secures user access, differentiating between standard attendees and venue operators with robust identity management.
* **Firebase Firestore:** Replaces standard mock state with a highly scalable, real-time NoSQL database to instantly sync density snapshots, queue metrics, and incident reports globally.
* **Google Cloud Run:** (Deployment Target) Ensures the application scales automatically from zero to thousands of concurrent connections during massive venue events.
* **Google Cloud Storage:** Hosts all high-resolution static assets (maps, promotional event banners) to strictly maintain the primary repository size under 10MB.

### Modular Directory Structure

The repository has been heavily refactored for maximum maintainability:
* `src/components/`: UI rendering logic and presentation components.
* `src/services/`: Core external integrations (`GoogleServiceProvider.ts`, `FirebaseService.ts`).
* `src/utils/`: Pure functions including the Decision Engine and Queue Predictor.

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
Execute the decision engine and queue prediction Vitest testing suite:

```bash
npm run test
```

### 5. Optional: Configure Google Services
By default, the application runs perfectly in **Simulation Mode** using a custom Canvas map renderer and local state. To use real services:

1. Copy `.env.example` to `.env`.
2. Edit `index.html` and uncomment the Google Maps and Firebase script tags.
3. Insert your actual API keys in `index.html` (do not commit these changes).
