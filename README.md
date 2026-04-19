# 🏟️ SmartVenue Assistant
### *Next-Gen AI Crowd Intelligence for Sporting Venue Excellence*

[![Enterprise Grade](https://img.shields.io/badge/Quality-Enterprise-blue.svg)](#)
[![AI Powered](https://img.shields.io/badge/AI-Gemini_Pro-purple.svg)](#)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-green.svg)](#)

SmartVenue Assistant is a high-performance, intelligent navigation ecosystem designed to revolutionize the attendee experience in massive sporting complexes. By synthesizing real-time sensor data, historical trends, and predictive AI, the Assistant eliminates bottlenecks and ensures a seamless, safe, and premium journey for every fan.

---

## 💎 Core Value Proposition

In modern stadiums, crowd congestion at gates, restrooms, and food stalls isn't just an inconvenience—it's a security risk and a revenue leak. SmartVenue Assistant solves this by:
- **Reducing Wait Times:** Intelligently redistributing fans to underutilized zones.
- **Enhancing Safety:** Real-time incident monitoring and automated emergency routing.
- **Boosting Engagement:** Personalized AI-driven event consultation and hospitality recommendations.

---

## 🧠 Intelligent Engine Workflow

The application operates on a 3-second high-frequency intelligence loop:

1.  **Dynamic Ingestion:** The `simulationEngine` generates high-fidelity data streams for occupancy, queue velocity, and incident triggers.
2.  **Predictive Analytics:** 
    - `incidentMonitor`: Scans for crowd density anomalies and triggers automated security alerts.
    - `queuePredictor`: Utilizes **Exponential Moving Average (EMA)** and growth-rate velocity to forecast future wait times with high confidence.
3.  **Heuristic Decision Matrix:** The `decisionEngine` evaluates every venue zone against a multi-factor weighted scoring model.
4.  **Real-Time Sync:** All intelligence is instantly synchronized via **Google Firebase** to ensure a single source of truth across the venue.

---

## 🛠️ Google Ecosystem — Service Inventory

| Service | Implementation Depth | Purpose |
| :--- | :--- | :--- |
| **Google Gemini Pro** | `gemini-1.5-flash` | Generates structured JSON operational audits and natural language consultation. |
| **Firebase Auth** | Anonymous Sign-In / RBAC | Zero-friction secure identity management and role detection. |
| **Firebase Firestore** | Real-Time NoSQL | Global state synchronization for zones, queues, and incidents. |
| **Google Maps SDK** | `visualization` Library | Geospatial rendering with high-density heatmap visualizations. |
| **Google Cloud Storage** | GCS Public Buckets | External hosting of high-resolution venue assets and config. |
| **Google Fonts** | `Inter`, `Material Symbols` | Premium typography and iconography system. |

---

## 🏗️ The Technical Stack (Enterprise Grade)

This project is a showcase of deep integration within the Google Cloud and AI ecosystem:

*   **Google Gemini Pro (via @google/generative-ai):** Powers the **AI Event Consultant** and the **Operational Audit Engine**. This utilizes specialized system prompts to return structured JSON data for app logic.
*   **Firebase Authentication:** Implements zero-friction **Anonymous Sign-In** with Role-Based Access Control (RBAC) to differentiate between Attendees and Venue Operators.
*   **Firebase Firestore:** A real-time, scalable NoSQL backbone that handles all high-frequency data synchronization for zones, queues, and incidents.
*   **Google Maps JS API:** Provides the geospatial context, utilizing the **Visualization library** for advanced heatmap overlays to visualize venue density in real-time.
*   **Google Cloud Storage (GCS):** Hosts all high-resolution static assets (maps, promotional event banners) to strictly maintain the primary repository size under 1MB.
*   **Vite & TypeScript:** A modern, strictly-typed build pipeline ensuring 100% type safety and optimized production bundles.
*   **Vite PWA:** Fully offline-capable architecture with Service Workers for resilience in high-density areas with spotty connectivity.

---

## ⚖️ Decision Scoring Model

Our proprietary scoring algorithm ensures optimal routing by balancing four critical dimensions:

```text
Score = (Dist × W_dist) + (Queue × W_queue) + (Density × W_den) + Incident_Penalty
```

| Factor | Description |
| :--- | :--- |
| **Distance** | Geospatial proximity using the Haversine formula. |
| **Queue** | Normalized wait time forecasting (Length / Service Rate). |
| **Density** | Real-time occupancy percentage of the target zone. |
| **Incident** | Massive penalty applied to zones with active hazards or closures. |

> [!IMPORTANT]
> **Emergency Mode:** When activated, the weights shift instantly to prioritize the nearest safety exits, overriding comfort-based factors like queue length.

---

## 🔒 Security & Performance

- **Sanitized Data Layers:** All Firestore writes pass through a strict validation layer to prevent injection or schema corruption.
- **Accessibility (A11y):** 100% compliant with ARIA standards, including high-contrast mode and screen-reader optimized logs.
- **Zero-Key Leakage:** Secure environment variable management via Vite's `.env` system.
- **Repository Optimization:** All high-resolution media is hosted externally via **Google Cloud Storage** to keep the core repository under 1MB.

---

## 🚀 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Launch Development Environment
```bash
npm run dev
```

### 3. Verification & Testing
```bash
npm run test
```

### 4. Live Mode Configuration
To enable the full Google Cloud experience:
1. Copy `.env.example` to `.env`.
2. Populate your **VITE_FIREBASE_API_KEY** and **VITE_GEMINI_KEY**.
3. Change `VITE_APP_MODE` to `live`.

---

© 2026 SmartVenue Enterprise Analytics. Built for the PromptWars competition.
