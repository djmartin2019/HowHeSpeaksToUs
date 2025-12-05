/**
 * Essential Contentful Types
 */

// Basic content types
export interface BlogPost {
  sys: { id: string };
  fields: {
    title: string;
    slug: string;
    excerpt?: string;
    content: any;
    featuredImage?: any;
    author?: string;
    publishDate: string;
    tags?: string[];
  };
}

export interface Page {
  sys: { id: string };
  fields: {
    title: string;
    slug: string;
    content: any;
  };
}

export interface DailyVerse {
  sys: { id: string };
  fields: {
    verse: any; // Rich text (localized)
    date: string; // Date & time (display date)
    description?: any; // Rich text (blurb about the verse)
    passage?: string; // Long text - Bible reference (e.g., "John 3:16")
    tag?: string[]; // Short text, list - tags for filtering
  };
}

// Collection types
export interface ContentfulCollection<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export type BlogPostCollection = ContentfulCollection<BlogPost>;
export type PageCollection = ContentfulCollection<Page>;
export type DailyVerseCollection = ContentfulCollection<DailyVerse>;
