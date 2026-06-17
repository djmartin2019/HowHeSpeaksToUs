/**
 * Build-scoped content catalogs — fetch each content type once per build.
 */
import {
  fetchAllEntries,
  formatDate,
  getAssetUrl,
  resolveAsset,
  logContentfulCacheStats,
} from "./contentful";

export { formatDate, getAssetUrl, resolveAsset, logContentfulCacheStats };

export interface CatalogResponse {
  items: any[];
  includes: any;
  total: number;
}

let blogPostsCatalog: Promise<CatalogResponse> | null = null;
let dailyVersesCatalog: Promise<CatalogResponse> | null = null;
let resourcesCatalog: Promise<CatalogResponse> | null = null;
let pagesCatalog: Promise<CatalogResponse> | null = null;

export async function getAllBlogPosts(): Promise<CatalogResponse> {
  if (!blogPostsCatalog) {
    blogPostsCatalog = fetchAllEntries({
      content_type: "blogPost",
      order: ["-fields.publishDate"],
      include: 10,
    });
  }
  return blogPostsCatalog;
}

export async function getAllDailyVerses(): Promise<CatalogResponse> {
  if (!dailyVersesCatalog) {
    dailyVersesCatalog = fetchAllEntries({
      content_type: "dailyVerse",
      order: ["-fields.date"],
      include: 10,
      locale: "en-US",
    });
  }
  return dailyVersesCatalog;
}

export async function getAllResources(): Promise<CatalogResponse> {
  if (!resourcesCatalog) {
    resourcesCatalog = fetchAllEntries({
      content_type: "resource",
      order: ["-fields.publishDate"],
      include: 10,
    });
  }
  return resourcesCatalog;
}

export async function getAllPages(): Promise<CatalogResponse> {
  if (!pagesCatalog) {
    pagesCatalog = fetchAllEntries({
      content_type: "page",
      order: ["fields.title"],
      include: 1,
    });
  }
  return pagesCatalog;
}

export async function getBlogPostBySlug(slug: string) {
  const { items } = await getAllBlogPosts();
  return items.find((post) => post?.fields?.slug === slug) ?? null;
}

export async function getDailyVerseByDate(dateString: string) {
  const { items } = await getAllDailyVerses();
  return (
    items.find((verse) => {
      if (!verse?.fields?.date) return false;
      const verseDate = new Date(verse.fields.date).toISOString().split("T")[0];
      return verseDate === dateString;
    }) ?? null
  );
}

export async function getResourceBySlug(slug: string) {
  const { items } = await getAllResources();
  return items.find((resource) => resource?.fields?.slug === slug) ?? null;
}

export async function getPageBySlug(slug: string) {
  const { items } = await getAllPages();
  return items.find((page) => page?.fields?.slug === slug) ?? null;
}

export async function getRecentBlogPosts(limit = 5) {
  const catalog = await getAllBlogPosts();
  return {
    ...catalog,
    items: catalog.items.slice(0, limit),
  };
}

export async function getRecentDailyVerses(limit = 5) {
  const catalog = await getAllDailyVerses();
  return {
    ...catalog,
    items: catalog.items.slice(0, limit),
  };
}

export async function getRecentResources(limit = 5) {
  const catalog = await getAllResources();
  return {
    ...catalog,
    items: catalog.items.slice(0, limit),
  };
}

export async function getTodayVerse() {
  const today = new Date().toISOString().split("T")[0];
  return getDailyVerseByDate(today);
}
