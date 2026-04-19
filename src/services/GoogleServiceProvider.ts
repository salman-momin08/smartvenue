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

  // Model Configuration
  private readonly PRIMARY_MODEL = "gemini-2.5-flash";
  private readonly FALLBACK_MODEL = "gemini-3-flash";

  private constructor() { }

  public static getInstance(): GoogleServiceProvider {
    if (!GoogleServiceProvider.instance) {
      GoogleServiceProvider.instance = new GoogleServiceProvider();
    }
    return GoogleServiceProvider.instance;
  }

  public init(config: Record<string, string>, geminiKey?: string): boolean {
    if (this.connected) return true;

    try {
      if (config && Object.keys(config).length > 0) {
        this.app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
        this.db = initializeFirestore(this.app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        });
        this.auth = getAuth(this.app);
      }

      this.geminiApiKey = geminiKey || import.meta.env?.VITE_GEMINI_KEY || null;
      if (this.geminiApiKey) {
        this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
      }

      this.connected = true;
      console.info('[GoogleServiceProvider] Initialized Modular Firebase & Gemini AI');
      return true;
    } catch (error) {
      console.error('[GoogleServiceProvider] Initialization failed:', error);
      return false;
    }
  }

  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Resilient Model Fetcher
   * Tries Flash first, falls back to Pro if 404.
   */
  private getModel(name: string = this.PRIMARY_MODEL) {
    if (!this.genAI) return null;
    return this.genAI.getGenerativeModel({
      model: name,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
      ]
    });
  }

  public async getGeminiConsultantAdvice(context: string): Promise<string> {
    if (!this.genAI) return "AI Consultant offline.";

    try {
      let model = this.getModel(this.PRIMARY_MODEL);
      const prompt = `You are a Senior Exhibition Floor Manager at PromptWars, a large-scale international tech hackathon and expo with 5,000+ attendees. The venue is a multi-hall exhibition center with booth zones (AI/ML, Cloud, DevTools, Startups), a Main Keynote Stage, Workshop Theater, Developer Lounge, Networking Hub, food courts, and multiple registration points.

Given the current venue context: "${context}"

Provide 2 concise paragraphs of actionable advice covering:
1. Crowd flow optimization between booth zones and stages (preventing bottlenecks during keynote transitions)
2. Safety, staffing, and catering recommendations specific to a tech exhibition environment

Be specific with zone names and use data-driven language.`;

      try {
        const result = await model!.generateContent(prompt);
        return (await result.response).text();
      } catch (err: unknown) {
        const e = err as Error;
        if (e.message?.includes('404') || e.message?.includes('not found')) {
          console.warn(`[Gemini] ${this.PRIMARY_MODEL} not found. Falling back to ${this.FALLBACK_MODEL}`);
          model = this.getModel(this.FALLBACK_MODEL);
          const result = await model!.generateContent(prompt);
          return (await result.response).text();
        }
        throw e;
      }
    } catch (err: unknown) {
      console.error('[GoogleServiceProvider] Gemini Error:', err);
      return "AI Consultant experienced a connectivity error.";
    }
  }

  public async predictCrowdSurges(queues: Map<string, QueueState>): Promise<string> {
    if (!this.genAI) return "[]";
    try {
      const model = this.getModel(this.PRIMARY_MODEL);
      const prompt = `You are the AI operations engine for PromptWars, a major tech exhibition. Analyze these queue metrics from registration desks, booth zones, food courts, and lounges. Identify exactly 2 zones likely to experience severe crowd surges in the next 10 minutes. Output ONLY a JSON array: [{"zoneId": "...", "reason": "...", "severity": "HIGH|CRITICAL"}]. Data: ${JSON.stringify(Array.from(queues.values()).map(q => ({ id: q.zoneId, name: q.zoneName, history: q.history })))}`;

      try {
        const result = await model!.generateContent(prompt);
        return (await result.response).text().replace(/```json\n|\n```|```/g, '').trim();
      } catch (err: unknown) {
        const e = err as Error;
        if (e.message?.includes('404')) {
          const fallback = this.getModel(this.FALLBACK_MODEL);
          const result = await fallback!.generateContent(prompt);
          return (await result.response).text().replace(/```json\n|\n```|```/g, '').trim();
        }
        throw e;
      }
    } catch (err: unknown) {
      return "[]";
    }
  }

  public async getVenueOperationalAudit(venueState: unknown): Promise<any> {
    if (!this.genAI) return null;
    try {
      const model = this.getModel(this.PRIMARY_MODEL);
      const prompt = `You are auditing the PromptWars International Exhibition Hall. Analyze zone occupancy, booth traffic, stage capacity, and food court throughput. Return ONLY raw JSON: {"efficiencyRating": 0-100, "bottleneckZone": "zone name", "staffingReallocation": "recommendation", "safetyRiskLevel": "LOW|MEDIUM|HIGH"}. Venue data: ${JSON.stringify(venueState)}`;

      try {
        const result = await model!.generateContent(prompt);
        return JSON.parse((await result.response).text().replace(/```json\n|\n```|```/g, '').trim());
      } catch (err: unknown) {
        const e = err as Error;
        if (e.message?.includes('404')) {
          const fallback = this.getModel(this.FALLBACK_MODEL);
          const result = await fallback!.generateContent(prompt);
          return JSON.parse((await result.response).text().replace(/```json\n|\n```|```/g, '').trim());
        }
        throw e;
      }
    } catch (err: unknown) {
      return null;
    }
  }

  public async signInAnonymous(): Promise<User | null> {
    if (!this.auth) return null;
    try {
      return (await signInAnonymously(this.auth)).user;
    } catch (e) {
      return null;
    }
  }

  public async checkAdminStatus(uid: string): Promise<boolean> {
    if (!this.db) return false;
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      return (await getDoc(doc(this.db, 'admin_users', uid))).exists();
    } catch (err) {
      return false;
    }
  }
}
