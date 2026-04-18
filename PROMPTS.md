# System Prompts Document

This file documents the core prompts used to instruct the AI (Google Antigravity / Gemini Pro) during the architecture and development of the SmartVenue Assistant.

## 1. Initial Architecture Prompt
**Goal:** Establish a lightweight, zero-bundler Vanilla TypeScript foundation.
```text
Build a lightweight smart assistant web application that improves attendee experience inside large-scale sporting venues by intelligently guiding users toward faster routes, shorter queues, and safer movement decisions using real-time simulated venue intelligence.
The repository must remain under 1MB while demonstrating strong engineering structure, security awareness, and integration with Google services.
Use Vanilla TypeScript, CSS modules, Google Maps API, and Firebase Web SDK.
```

## 2. Decision Engine Implementation
**Goal:** Implement the logic for routing attendees dynamically based on density and wait times.
```text
Implement a weighted scoring formula (distance, queue, density) with emergency mode overrides and incident penalties. Ensure it handles edge cases like closed zones and critical capacity alerts seamlessly. Add unit tests to verify the logic.
```

## 3. Real-Time Integration & Optimization
**Goal:** Connect to Firebase for live synchronization and optimize the map visualization.
```text
Integrate real-time Firestore listeners for zone densities and incidents. Optimize the MapRenderer to gracefully fall back to an HTML5 Canvas implementation if the Google Maps API key is omitted, ensuring a flawless demo experience. Ensure all cards and interactive elements are fully accessible.
```

## 4. Google Services Deep Integration (PromptWars Update)
**Goal:** Maximize Google Ecosystem utilization and code maintainability.
```text
Implement Firebase Authentication for user login.
Replace local storage/mock data with Firestore for real-time venue updates.
Integrate Gemini API (Google AI SDK) to provide an 'AI Event Consultant' feature.
Implement a central GoogleServiceProvider to manage all Google-related API initializations.
Add JSDoc comments to all core functions.
```
