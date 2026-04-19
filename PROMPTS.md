# 🤖 Engineering Prompt Methodology
### *SmartVenue Assistant Development Lifecycle*

This document catalogs the strategic prompts used to drive the architecture, logic, and integration phases of the SmartVenue Assistant using Google Antigravity and Gemini Pro.

---

## 🏗️ Phase 1: Architectural Foundation
**Prompt Strategy:** *Strict Constraint Engineering*

> "Act as a Senior Cloud Architect. Design a lightweight, zero-dependency Vanilla TypeScript foundation for a 'SmartVenue Assistant'. 
> **Core Requirements:**
> 1. Modular architecture (Services, Utils, Components).
> 2. PWA readiness with service worker support.
> 3. Zero-bundler approach for maximum transparency.
> 4. Strict Security: No hardcoded keys, explicit input sanitization.
> 5. Repository footprint must stay under 1MB by offloading static assets to GCS."

---

## 🧠 Phase 2: Decision Engine & Heuristics
**Prompt Strategy:** *Mathematical Logic Synthesis*

> "Develop a `DecisionEngine` utility. Implement a weighted heuristic algorithm to recommend the 'optimal' venue zone.
> **Variables:** `distance` (Haversine), `queueLength`, `serviceRate`, `densityScore`.
> **Logic:**
> - Apply `IncidentPenalty` (+Infinity for closures).
> - Implement `EmergencyMode` override to prioritize exit proximity.
> - Normalize all factors to a 0.0 - 1.0 scale.
> - Return a structured `NavigationDecision` object with human-readable reasoning."

---

## 📊 Phase 3: Predictive Analytics & Sync
**Prompt Strategy:** *Contextual Real-Time Integration*

> "Create a `QueuePredictor` using an **Exponential Moving Average (EMA)** algorithm. 
> - Input: Historical queue snapshots (last 5 cycles).
> - Output: Predicted wait time and confidence score.
> - Integrate this with a `FirebaseService` that utilizes real-time Firestore listeners. 
> - Ensure the UI reflects these predictions with trend indicators (📈/📉)."

---

## ✨ Phase 4: Generative AI (Gemini Pro) Integration
**Prompt Strategy:** *Professional Role-Play & Safety Alignment*

> "Integrate Gemini Pro via the `@google/generative-ai` SDK. 
> - **Feature:** 'AI Event Consultant'. 
> - **Prompt Design:** 'You are an expert Venue Operations Manager. Analyze the following queue data: [DATA]. Provide a 2-paragraph strategic recommendation on layout and catering distribution.'
> - **Constraints:** Enforce strict safety settings for harassment and dangerous content. Use `gemini-2.5-flash` for low-latency response."

---

## 🔒 Phase 5: Security Hardening & A11y
**Prompt Strategy:** *Compliance & Resilience*

> "Audit the `panelRenderer.ts` for accessibility.
> - Ensure all dynamic elements have `aria-live` regions.
> - Implement a high-contrast mode toggle.
> - Add global error boundaries to prevent app crashes if a Google API fails.
> - Sanitize all user-displayed strings to prevent XSS."

---

## 🧪 Phase 6: Quality Assurance
**Prompt Strategy:** *Unit Test Generation*

> "Generate a Vitest suite for the `DecisionEngine`. Test the following scenarios:
> 1. Normal conditions (best gate selected).
> 2. High density spike (user rerouted).
> 3. Active incident (zone avoided).
> 4. Emergency mode (safety first)."

---

## ☁️ Phase 7: Deep Cloud Ecosystem Adoption
**Prompt Strategy:** *Multi-Service Orchestration*

> "Expand the application's Google Cloud footprint to maximize operational depth.
> 1. **Google Cloud Storage (GCS):** Implement a `StorageService` to fetch dynamic JSON configurations and high-resolution assets from a public GCS bucket.
> 2. **Advanced Gemini (Structured Output):** Update the AI integration to generate structured JSON operational audits (`efficiencyRating`, `bottleneckZone`) to drive internal application logic.
> 3. **Google Maps Visualization:** Enable the `visualization` library in the Maps SDK and implement a heatmap layer to represent live crowd density data fetched from Firestore."

---

*This methodology ensures that every line of code is backed by a clear architectural intent and optimized for the Google Cloud ecosystem.*
