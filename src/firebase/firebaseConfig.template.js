/**
 * SmartVenue — Firebase Configuration Template
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to firebaseConfig.js
 * 2. Replace placeholder values with your real Firebase project config
 * 3. NEVER commit the real config file to version control
 * 
 * To get these values:
 * - Go to Firebase Console → Project Settings → General
 * - Scroll to "Your apps" → Web app → Config
 */

// @ts-nocheck
export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

/**
 * Firestore Collections Used:
 * 
 * zones/          — Zone density & occupancy data
 * queues/         — Queue length & service rate
 * incidents/      — Active and historical incidents
 * routingSuggestions/ — Decision engine outputs
 * 
 * Security Rules (recommended):
 * 
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /zones/{zoneId} {
 *       allow read: if true;
 *       allow write: if request.auth != null && request.auth.token.role == 'operator';
 *     }
 *     match /queues/{queueId} {
 *       allow read: if true;
 *       allow write: if request.auth != null;
 *     }
 *     match /incidents/{incidentId} {
 *       allow read: if true;
 *       allow write: if request.auth != null && request.auth.token.role == 'operator';
 *     }
 *     match /routingSuggestions/{docId} {
 *       allow read: if true;
 *       allow write: if request.auth != null;
 *     }
 *   }
 * }
 */
