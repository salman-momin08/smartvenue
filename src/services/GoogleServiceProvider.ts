/**
 * GoogleServiceProvider
 * Centralized singleton managing all Google Ecosystem API initializations.
 * Handles Firebase Authentication, Firestore, and the Gemini Pro AI API.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore,
  getDoc,
  doc
} from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth, User } from 'firebase/auth';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { QueueState } from '../types.js';

export class GoogleServiceProvider {
  private static instance: GoogleServiceProvider;
  public db: Firestore | null = null;
  public auth: Auth | null = null;
  public geminiApiKey: string | null = null;
  private connected: boolean = false;
  private genAI: GoogleGenerativeAI | null = null;
  private app: FirebaseApp | null = null;

  private constructor() {}

  /** 
   * Singleton accessor 
   * @returns {GoogleServiceProvider} The singleton instance
   */
  public static getInstance(): GoogleServiceProvider {
    if (!GoogleServiceProvider.instance) {
      GoogleServiceProvider.instance = new GoogleServiceProvider();
    }
    return GoogleServiceProvider.instance;
  }

  /**
   * Initializes Firebase and Gemini SDKs using the modern Modular pattern.
   * Resolves deprecation warnings for persistent cache.
   * @param config Firebase configuration object
   * @param geminiKey Optional Gemini API key
   * @returns {boolean} True if successfully initialized
   */
  public init(config: Record<string, string>, geminiKey?: string): boolean {
    if (this.connected) return true;

    try {
      if (config && Object.keys(config).length > 0) {
        // Initialize Firebase App
        this.app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
        
        // Initialize Firestore with Modern Persistent Cache (Resolves Deprecation Warning)
        this.db = initializeFirestore(this.app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        });

        // Initialize Auth
        this.auth = getAuth(this.app);
      }
      
      // Pull from VITE env if not passed explicitly
      this.geminiApiKey = geminiKey || import.meta.env?.VITE_GEMINI_KEY || null;
      
      if (this.geminiApiKey) {
        this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
      }
      
      this.connected = true;
      console.info('[GoogleServiceProvider] Successfully initialized Modular Firebase & Google AI (Gemini)');
      return true;
    } catch (error) {
      console.error('[GoogleServiceProvider] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Checks if the provider is successfully connected.
   * @returns {boolean} Connection status
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * AI Event Consultant powered by Gemini Pro via @google/generative-ai SDK.
   * @param {string} context Description of the event
   * @returns {Promise<string>} AI-generated consultation string
   */
  public async getGeminiConsultantAdvice(context: string): Promise<string> {
    if (!this.genAI) return "Gemini AI API Key not configured. AI Consultant offline.";
    
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const safetySettings = [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ];

      const prompt = `You are an expert Event Manager. I am hosting a ${context} in a massive exhibition hall. Provide a brief 2-paragraph professional recommendation on the best layout, security routing, and catering distribution.`;
      
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        safetySettings,
      });

      const response = await result.response;
      return response.text() || "No insights generated.";
    } catch (err) {
      console.error('[GoogleServiceProvider] Gemini Error:', err);
      return "AI Consultant experienced an error.";
    }
  }

  /**
   * Enterprise Predictive Analytics: Analyze queue history trends
   * @param {Map<string, QueueState>} queues The active queue states with history arrays
   * @returns {Promise<string>} AI-generated JSON string of predicted surges
   */
  public async predictCrowdSurges(queues: Map<string, QueueState>): Promise<string> {
    if (!this.genAI) return "[]";
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Analyze this venue queue history (last 5 cycles) and identify exactly 2 zones that will have severe crowd surges in the next 10 minutes.
Output ONLY a strict raw JSON array of objects (no markdown, no backticks) with keys:
- zoneId (string)
- reason (string: why staff should move here)
- severity (string: 'High' or 'Critical')

Queue Data: ${JSON.stringify(Array.from(queues.values()).map(q => ({ zoneId: q.zoneId, history: q.history, currentWait: q.estimatedWaitMinutes })))}`;
      
      const result = await model.generateContent(prompt);
      const text = await result.response.text();
      return text.replace(/```json\n|\n```|```/g, '').trim();
    } catch(err) {
      console.error('[GoogleServiceProvider] Predictive analytics error:', err);
      return "[]";
    }
  }

  /**
   * Enterprise Operational Audit: Uses Gemini Pro to analyze entire venue state
   * @param {any} venueState Serialized state of all zones and queues
   * @returns {Promise<any>} Structured JSON audit
   */
  public async getVenueOperationalAudit(venueState: any): Promise<any> {
    if (!this.genAI) return null;
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Perform a professional Venue Operations Audit. 
Analyze these zones and queues: ${JSON.stringify(venueState)}.
Return ONLY a raw JSON object with:
- "efficiencyRating": (0-100)
- "bottleneckZone": (zoneId)
- "staffingReallocation": (string description)
- "safetyRiskLevel": ("Low", "Medium", "High")`;

      const result = await model.generateContent(prompt);
      const text = await result.response.text();
      return JSON.parse(text.replace(/```json\n|\n```|```/g, '').trim());
    } catch (err) {
      console.error('[GoogleServiceProvider] Audit Error:', err);
      return null;
    }
  }

  /**
   * Authenticate a user anonymously
   * @returns {Promise<User | null>} The authenticated user
   */
  public async signInAnonymous(): Promise<User | null> {
    if (!this.auth) return null;
    try {
      const credential = await signInAnonymously(this.auth);
      return credential.user;
    } catch (e) {
      console.error('[GoogleServiceProvider] Auth Error:', e);
      return null;
    }
  }

  /**
   * Check if a specific document exists in a collection (Modular)
   * Includes a retry delay to handle early-boot connectivity issues.
   */
  public async checkAdminStatus(uid: string): Promise<boolean> {
    if (!this.db) return false;
    try {
      // Small delay to ensure Firestore connection is active
      await new Promise(resolve => setTimeout(resolve, 800));
      const docRef = doc(this.db, 'admin_users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (err) {
      // Quietly fail as 'attendee' if offline during initial boot
      return false;
    }
  }
}
