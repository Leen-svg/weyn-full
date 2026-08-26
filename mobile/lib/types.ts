/** Shapes returned by the existing Next.js routes. Kept in sync by hand. */

export type Tag = {
  id: string;
  category_id: string;
  slug: string;
  display_name: string;
  subgroup: string | null;
  subgroup_order: number | null;
  display_order: number | null;
  seasonal_exclude: boolean | null;
};

export type TagGroup = {
  id: string;
  slug: string;
  name: string;
  display_order: number | null;
  min_select: number | null;
  max_select: number | null;
  tags: Tag[];
};

export type Zone = {
  slug: string;
  name: string;
  emirate: string;
  display_order: number | null;
};

export type VenueTag = { display_name: string; display_order?: number | null };

export type Venue = {
  id: string;
  name: string;
  neighborhood?: string | null;
  city?: string | null;
  description?: string | null;
  avg_spend_aed?: number | null;
  age_restriction?: string | null;
  is_aesthetic?: boolean | null;
  cover_url?: string | null;
  hero_video_url?: string | null;
  menu_url?: string | null;
  media?: { url: string; type: string }[];
  media_count?: number;
  tags?: VenueTag[];
  lat?: number | null;
  lng?: number | null;
};

export type ShortlistRequest = {
  tags: string[];
  maxSpend: number;
  aestheticOnly: boolean;
  zones: string[];
  maxAge: 'all-ages' | '18-plus' | '21-plus';
  city: 'Abu Dhabi' | 'Dubai';
  nearby: { lat: number; lng: number; radiusKm: number } | null;
};

export type ShortlistResponse = {
  venues: Venue[];
  relaxed: boolean;
  budgetLifted: boolean;
  note: string | null;
};
