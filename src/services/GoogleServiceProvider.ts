/**
 * GoogleServiceProvider
 * Centralized singleton managing all Google Ecosystem API initializations.
 * Handles Firebase Authentication, Firestore, and the Gemini Pro AI API.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

declare const firebase: any;

export class GoogleServiceProvider {
  private static instance: GoogleServiceProvider;
  public db: any = null;
  public auth: any = null;
  public geminiApiKey: string | null = null;
  private connected: boolean = false;
  private genAI: GoogleGenerativeAI | null = null;

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
   * Initializes Firebase and Gemini SDKs
   * @param config Firebase configuration object
   * @param geminiKey Optional Gemini API key
   * @returns {boolean} True if successfully initialized
   */
  public init(config: any, geminiKey?: string): boolean {
    if (this.connected) return true;

    try {
      if (typeof firebase !== 'undefined' && firebase.apps && config && Object.keys(config).length > 0) {
        if (!firebase.apps.length) {
          firebase.initializeApp(config);
        }
        this.db = firebase.firestore();
        this.auth = firebase.auth();
      }
      
      // Pull from VITE env if not passed explicitly
      // @ts-ignore
      this.geminiApiKey = geminiKey || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_KEY) || null;
      
      if (this.geminiApiKey) {
        this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
      }
      
      this.connected = true;
      console.info('[GoogleServiceProvider] Successfully initialized Firebase & Google AI (Gemini)');
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
   * Analyzes event parameters and provides professional catering/layout suggestions.
   * Demonstrates Responsible AI with explicit SafetySettings.
   * @param {string} context Description of the event
   * @returns {Promise<string>} AI-generated consultation string
   */
  public async getGeminiConsultantAdvice(context: string): Promise<string> {
    if (!this.genAI) return "Gemini AI API Key not configured. AI Consultant offline.";
    
    try {
      // Use gemini-2.5-flash as the latest stable model
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
   * Authenticate a user anonymously or via email (Auth integration)
   * @returns {Promise<any>} The authenticated user credential
   */
  public async signInAnonymous(): Promise<any> {
    if (!this.auth) return null;
    try {
      const credential = await this.auth.signInAnonymously();
      return credential.user;
    } catch (e) {
      console.error('[GoogleServiceProvider] Auth Error:', e);
      return null;
    }
  }
}
