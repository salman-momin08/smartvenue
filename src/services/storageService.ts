/**
 * SmartVenue — Google Cloud Storage Service
 * Handles fetching of high-resolution venue assets and dynamic event banners.
 * Demonstrates GCP Storage integration for high-performance asset delivery.
 */

export class StorageService {
  private static instance: StorageService;
  private readonly BUCKET_BASE_URL = 'https://storage.googleapis.com/smartvenue-enterprise-assets';

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Fetches a signed URL or public asset URL for venue-specific imagery.
   * @param {string} assetPath Path within the GCS bucket
   * @returns {string} Fully qualified GCS URL
   */
  public getAssetUrl(assetPath: string): string {
    // In a production environment, this might involve calling a backend to get a signed URL
    // For the SmartVenue demo, we point to the optimized enterprise bucket.
    return `${this.BUCKET_BASE_URL}/${assetPath}`;
  }

  /**
   * Retrieves current event promotional metadata hosted on GCS.
   */
  public async getEventPromo(): Promise<{ title: string; imageUrl: string }> {
    try {
      // Demonstrates fetching JSON configuration from GCS
      const response = await fetch(this.getAssetUrl('current-event.json'));
      if (!response.ok) throw new Error('GCS Fetch failed');
      return await response.ok ? response.json() : { title: 'Championship Finals', imageUrl: this.getAssetUrl('banner-default.png') };
    } catch (err) {
      // Fallback for demo stability
      return { 
        title: 'SmartVenue Grand Opening', 
        imageUrl: '/logo.png' 
      };
    }
  }
}
