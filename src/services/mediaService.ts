import { extractYouTubeVideoId, getYouTubeThumbnailUrl, formatStandardYouTubeUrl } from '../utils/youtube';
import { carService } from './carService';
import { MEDIA_REVIEWS } from '../data/brandsAndTypes';

export type MediaVideoType =
  | 'Car Review'
  | 'Car Walkaround'
  | 'Car Hunt'
  | 'Buying Guide'
  | 'Market Insight'
  | 'Other';

export interface MediaVideoItem {
  id: string;
  title: string;
  video_type: MediaVideoType;
  youtube_url: string;
  youtube_video_id: string;
  youtube_thumbnail_url: string;
  car_id?: string;
  car_title?: string;
  description?: string;
  status: 'Draft' | 'Published' | 'Archived';
  is_featured: boolean;
  is_primary: boolean;
  duration?: string;
  views_count?: string;
  presenter?: string;
  created_at: string;
}

const MEDIA_STORAGE_KEY = 'manifold_media_videos_v1';

type MediaChangeListener = (videos: MediaVideoItem[]) => void;

class MediaService {
  private videos: MediaVideoItem[] = [];
  private listeners: Set<MediaChangeListener> = new Set();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    try {
      const stored = localStorage.getItem(MEDIA_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.videos = parsed;
          this.initialized = true;
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load media videos from localStorage', e);
    }

    // Seed from existing car videos and MEDIA_REVIEWS
    const cars = carService.getCarsSync();
    const initialVideos: MediaVideoItem[] = [];

    cars.forEach((car, index) => {
      if (car.video && car.video.youtube_url) {
        initialVideos.push({
          id: `media-car-${car.id}`,
          title: car.video.video_title || `${car.title} Full Review`,
          video_type: car.video.video_type === 'walkaround' ? 'Car Walkaround' : 'Car Review',
          youtube_url: car.video.youtube_url,
          youtube_video_id: car.video.youtube_video_id,
          youtube_thumbnail_url: car.video.youtube_thumbnail_url || getYouTubeThumbnailUrl(car.video.youtube_video_id),
          car_id: car.id,
          car_title: car.title,
          description: car.description?.substring(0, 150) || `Official MANIFOLD verified inspection review for ${car.title}`,
          status: 'Published',
          is_featured: index < 3,
          is_primary: true,
          duration: car.video.video_duration || '12:30',
          views_count: `${car.views_count || 1200} views`,
          presenter: car.video.presenter_name || 'MANIFOLD Media Team',
          created_at: car.created_at || new Date().toISOString(),
        });
      }
    });

    // Add media reviews from brandsAndTypes
    MEDIA_REVIEWS.forEach((mr, idx) => {
      if (!initialVideos.some((v) => v.youtube_url === mr.youtube_url)) {
        const vidId = extractYouTubeVideoId(mr.youtube_url) || `sample-${idx}`;
        initialVideos.push({
          id: `media-editorial-${mr.id}`,
          title: mr.title,
          video_type: (mr.category === 'Car Hunt' ? 'Car Hunt' : mr.category === 'Buying Tips' ? 'Buying Guide' : 'Car Review') as MediaVideoType,
          youtube_url: mr.youtube_url,
          youtube_video_id: vidId,
          youtube_thumbnail_url: mr.thumbnail_url || getYouTubeThumbnailUrl(vidId),
          description: mr.description,
          status: 'Published',
          is_featured: true,
          is_primary: false,
          duration: mr.duration,
          views_count: mr.views,
          presenter: 'MANIFOLD Editorial',
          created_at: new Date(Date.now() - idx * 86400000).toISOString(),
        });
      }
    });

    this.videos = initialVideos;
    this.saveToStorage();
    this.initialized = true;
  }

  private saveToStorage() {
    try {
      localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(this.videos));
    } catch (e) {
      console.warn('Failed to save media videos to localStorage', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener([...this.videos]);
      } catch (e) {
        console.error('MediaService listener error', e);
      }
    });
  }

  public async getVideos(): Promise<MediaVideoItem[]> {
    this.init();
    return [...this.videos];
  }

  public getVideosSync(): MediaVideoItem[] {
    this.init();
    return [...this.videos];
  }

  public async getVideoById(id: string): Promise<MediaVideoItem | null> {
    this.init();
    const found = this.videos.find((v) => v.id === id);
    return found ? { ...found } : null;
  }

  public async getVideosByCarId(carId: string): Promise<MediaVideoItem[]> {
    this.init();
    return this.videos.filter((v) => v.car_id === carId);
  }

  public async createVideo(data: Partial<MediaVideoItem>): Promise<MediaVideoItem> {
    this.init();
    const videoId = extractYouTubeVideoId(data.youtube_url || '') || '';
    const youtubeUrl = data.youtube_url ? formatStandardYouTubeUrl(videoId || data.youtube_url) : '';
    const thumbnailUrl = data.youtube_thumbnail_url || (videoId ? getYouTubeThumbnailUrl(videoId) : '');

    const newVideo: MediaVideoItem = {
      id: data.id || `media-${Date.now()}`,
      title: data.title || 'Untitled Video Review',
      video_type: data.video_type || 'Car Review',
      youtube_url: youtubeUrl,
      youtube_video_id: videoId,
      youtube_thumbnail_url: thumbnailUrl,
      car_id: data.car_id,
      car_title: data.car_title,
      description: data.description || '',
      status: data.status || 'Published',
      is_featured: !!data.is_featured,
      is_primary: !!data.is_primary,
      duration: data.duration || '10:00',
      views_count: data.views_count || '1 view',
      presenter: data.presenter || 'MANIFOLD Media Team',
      created_at: new Date().toISOString(),
    };

    // If marked primary and attached to a vehicle, handle primary synchronization
    if (newVideo.car_id && newVideo.is_primary) {
      await this.syncPrimaryVideoWithCar(newVideo.car_id, newVideo);
    }

    this.videos.unshift(newVideo);
    this.saveToStorage();
    return { ...newVideo };
  }

  public async updateVideo(id: string, updates: Partial<MediaVideoItem>): Promise<MediaVideoItem> {
    this.init();
    const index = this.videos.findIndex((v) => v.id === id);
    if (index === -1) {
      throw new Error(`Media video with ID ${id} not found.`);
    }

    const existing = this.videos[index];
    const newYoutubeUrl = updates.youtube_url ?? existing.youtube_url;
    const videoId = extractYouTubeVideoId(newYoutubeUrl) || existing.youtube_video_id;
    const thumbnailUrl = updates.youtube_thumbnail_url ?? (videoId ? getYouTubeThumbnailUrl(videoId) : existing.youtube_thumbnail_url);

    const updated: MediaVideoItem = {
      ...existing,
      ...updates,
      id: existing.id,
      youtube_url: newYoutubeUrl ? formatStandardYouTubeUrl(videoId || newYoutubeUrl) : existing.youtube_url,
      youtube_video_id: videoId,
      youtube_thumbnail_url: thumbnailUrl,
    };

    // If marked primary and has car_id, sync with car
    if (updated.car_id && updated.is_primary) {
      await this.syncPrimaryVideoWithCar(updated.car_id, updated, id);
    }

    this.videos[index] = updated;
    this.saveToStorage();
    return { ...updated };
  }

  public async deleteVideo(id: string): Promise<boolean> {
    this.init();
    const index = this.videos.findIndex((v) => v.id === id);
    if (index === -1) return false;
    this.videos.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  /**
   * Enforces that only one video is designated primary for a vehicle.
   * Updates the vehicle's own primary video fields.
   */
  private async syncPrimaryVideoWithCar(carId: string, primaryVideo: MediaVideoItem, excludeVideoId?: string) {
    // 1. Remove is_primary from any other video for this car
    this.videos.forEach((v) => {
      if (v.car_id === carId && v.id !== excludeVideoId) {
        v.is_primary = false;
      }
    });

    // 2. Update the car record itself
    try {
      await carService.updateCar(carId, {
        video: {
          youtube_video_id: primaryVideo.youtube_video_id,
          youtube_url: primaryVideo.youtube_url,
          youtube_thumbnail_url: primaryVideo.youtube_thumbnail_url,
          video_title: primaryVideo.title,
          video_duration: primaryVideo.duration || '12:00',
          video_type: primaryVideo.video_type === 'Car Walkaround' ? 'walkaround' : 'full_review',
          is_primary: true,
          presenter_name: primaryVideo.presenter || 'MANIFOLD Media Team',
        },
      });
    } catch (e) {
      console.error('Failed to update car primary video', e);
    }
  }

  public subscribe(listener: MediaChangeListener): () => void {
    this.listeners.add(listener);
    listener([...this.videos]);
    return () => this.listeners.delete(listener);
  }
}

export const mediaService = new MediaService();
