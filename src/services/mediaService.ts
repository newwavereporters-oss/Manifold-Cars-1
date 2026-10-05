import { extractYouTubeVideoId, getYouTubeThumbnailUrl, formatStandardYouTubeUrl } from '../utils/youtube';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

type MediaChangeListener = (videos: MediaVideoItem[]) => void;

function mapSupabaseToMediaItem(row: any): MediaVideoItem {
  const vidId = row.youtube_video_id || extractYouTubeVideoId(row.youtube_url) || '';
  const thumb = row.youtube_thumbnail_url || (vidId ? getYouTubeThumbnailUrl(vidId) : '');

  let vType: MediaVideoType = 'Car Review';
  if (row.video_type === 'walkaround' || row.video_type === 'Car Walkaround') vType = 'Car Walkaround';
  else if (row.video_type === 'car_hunt' || row.video_type === 'Car Hunt') vType = 'Car Hunt';
  else if (row.video_type === 'buying_guide' || row.video_type === 'Buying Guide') vType = 'Buying Guide';
  else if (row.video_type === 'market_insight' || row.video_type === 'Market Insight') vType = 'Market Insight';
  else if (row.video_type === 'Other') vType = 'Other';

  return {
    id: row.id,
    title: row.title || 'Vehicle Video Review',
    video_type: vType,
    youtube_url: row.youtube_url,
    youtube_video_id: vidId,
    youtube_thumbnail_url: thumb,
    car_id: row.car_id || undefined,
    car_title: row.cars?.title || row.car_title || undefined,
    description: row.description || '',
    status: (row.status === 'published' || row.status === 'Published') ? 'Published' : (row.status === 'archived' || row.status === 'Archived') ? 'Archived' : 'Draft',
    is_featured: Boolean(row.is_featured),
    is_primary: Boolean(row.is_primary),
    duration: row.duration || '12:00',
    views_count: row.views_count || '1.2k views',
    presenter: row.presenter || 'MANIFOLD Presenter',
    created_at: row.created_at || new Date().toISOString(),
  };
}

class MediaService {
  private cache: MediaVideoItem[] = [];
  private listeners: Set<MediaChangeListener> = new Set();
  private hasLoaded = false;

  public async getVideos(): Promise<MediaVideoItem[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('car_media')
      .select('*, cars (id, title)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load media reviews from Supabase: ${error.message}`);
    }

    this.cache = (data || []).map(mapSupabaseToMediaItem);
    this.hasLoaded = true;
    this.notify();
    return [...this.cache];
  }

  public getVideosSync(): MediaVideoItem[] {
    return [...this.cache];
  }

  public async getVideoById(id: string): Promise<MediaVideoItem | null> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('car_media')
      .select('*, cars (id, title)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load video: ${error.message}`);
    }

    return data ? mapSupabaseToMediaItem(data) : null;
  }

  public async getVideosByCarId(carId: string): Promise<MediaVideoItem[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('car_media')
      .select('*, cars (id, title)')
      .eq('car_id', carId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to load car media: ${error.message}`);
    }

    return (data || []).map(mapSupabaseToMediaItem);
  }

  /**
   * Section 11: CREATE YouTube Video in public.car_media
   */
  public async createVideo(data: Partial<MediaVideoItem>): Promise<MediaVideoItem> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const videoId = extractYouTubeVideoId(data.youtube_url || '') || '';
    if (!videoId) {
      throw new Error('Invalid YouTube URL provided.');
    }

    const youtubeUrl = formatStandardYouTubeUrl(videoId);
    const thumbnailUrl = data.youtube_thumbnail_url || getYouTubeThumbnailUrl(videoId);
    const id = data.id || `media-${Date.now()}`;

    // If marked primary and attached to a vehicle, clear primary on any other video for that vehicle
    if (data.car_id && data.is_primary) {
      await supabase
        .from('car_media')
        .update({ is_primary: false })
        .eq('car_id', data.car_id);
    }

    const insertRow = {
      id,
      car_id: data.car_id || null,
      media_type: 'youtube_video',
      video_type: data.video_type || 'Car Review',
      title: data.title || 'Untitled Video Review',
      youtube_url: youtubeUrl,
      youtube_video_id: videoId,
      youtube_thumbnail_url: thumbnailUrl,
      description: data.description || '',
      is_primary: Boolean(data.is_primary),
      status: (data.status || 'Published').toLowerCase(),
      sort_order: 1,
      duration: data.duration || '12:00',
      presenter: data.presenter || 'MANIFOLD Media Team',
    };

    const { error } = await supabase.from('car_media').insert(insertRow);
    if (error) {
      throw new Error(`Failed to create video review in Supabase: ${error.message}`);
    }

    await this.getVideos();
    const created = await this.getVideoById(id);
    if (!created) {
      throw new Error('Video created but could not be retrieved from Supabase.');
    }
    return created;
  }

  /**
   * Section 11: UPDATE YouTube Video in public.car_media
   */
  public async updateVideo(id: string, updates: Partial<MediaVideoItem>): Promise<MediaVideoItem> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const updateRow: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updateRow.title = updates.title;
    if (updates.video_type !== undefined) updateRow.video_type = updates.video_type;
    if (updates.description !== undefined) updateRow.description = updates.description;
    if (updates.status !== undefined) updateRow.status = updates.status.toLowerCase();
    if (updates.duration !== undefined) updateRow.duration = updates.duration;
    if (updates.presenter !== undefined) updateRow.presenter = updates.presenter;
    if (updates.is_primary !== undefined) updateRow.is_primary = updates.is_primary;
    if (updates.car_id !== undefined) updateRow.car_id = updates.car_id || null;

    if (updates.youtube_url) {
      const vidId = extractYouTubeVideoId(updates.youtube_url) || updates.youtube_video_id || '';
      updateRow.youtube_url = formatStandardYouTubeUrl(vidId || updates.youtube_url);
      updateRow.youtube_video_id = vidId;
      updateRow.youtube_thumbnail_url = updates.youtube_thumbnail_url || (vidId ? getYouTubeThumbnailUrl(vidId) : '');
    }

    // If setting primary, unset other videos for that car
    if (updates.car_id && updates.is_primary) {
      await supabase
        .from('car_media')
        .update({ is_primary: false })
        .eq('car_id', updates.car_id)
        .neq('id', id);
    }

    const { error } = await supabase.from('car_media').update(updateRow).eq('id', id);
    if (error) {
      throw new Error(`Failed to update video review in Supabase: ${error.message}`);
    }

    await this.getVideos();
    const updated = await this.getVideoById(id);
    if (!updated) {
      throw new Error('Updated video could not be retrieved from Supabase.');
    }
    return updated;
  }

  /**
   * Section 11: DELETE Video from public.car_media
   */
  public async deleteVideo(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase.from('car_media').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete video review from Supabase: ${error.message}`);
    }

    await this.getVideos();
    return true;
  }

  public subscribe(listener: MediaChangeListener): () => void {
    this.listeners.add(listener);
    if (this.hasLoaded) {
      listener([...this.cache]);
    } else {
      this.getVideos().catch(() => {});
    }
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const list = [...this.cache];
    this.listeners.forEach((listener) => {
      try {
        listener(list);
      } catch (e) {
        console.error('MediaService subscriber error:', e);
      }
    });
  }
}

export const mediaService = new MediaService();
