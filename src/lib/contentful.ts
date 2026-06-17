/**
 * Cloudflare-compatible Contentful Client and Helpers
 * Uses fetch instead of Node SDK for Cloudflare Pages compatibility
 */

// Types for Contentful content
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
  };
}

// Query parameters interface
export interface QueryParams {
  limit?: number;
  skip?: number;
  "fields.tags[in]"?: string | undefined;
  order?: string[];
}

// Environment variables for Cloudflare Pages
const getEnvVars = () => ({
  CONTENTFUL_SPACE_ID: import.meta.env.CONTENTFUL_SPACE_ID,
  CONTENTFUL_DELIVERY_TOKEN: import.meta.env.CONTENTFUL_DELIVERY_TOKEN,
  CONTENTFUL_ENVIRONMENT: import.meta.env.CONTENTFUL_ENVIRONMENT || "master",
});

// Generic query function using fetch — build-scoped in-memory cache
const queryCache = new Map<string, Promise<any>>();
let cacheHits = 0;
let cacheMisses = 0;

function buildContentfulUrl(
  query: any,
  spaceId: string,
  environment: string
): string {
  const params = new URLSearchParams();
  params.append("content_type", query.content_type);

  if (query.locale) params.append("locale", query.locale);
  if (query.limit) params.append("limit", query.limit.toString());
  if (query.skip) params.append("skip", query.skip.toString());
  if (query.include) params.append("include", query.include.toString());
  if (query.order) {
    if (Array.isArray(query.order)) {
      query.order.forEach((order: string) => params.append("order", order));
    } else {
      params.append("order", query.order);
    }
  }

  Object.entries(query).forEach(([key, value]) => {
    if (
      !["content_type", "locale", "limit", "skip", "include", "order"].includes(
        key
      )
    ) {
      params.append(key, String(value));
    }
  });

  return `https://cdn.contentful.com/spaces/${spaceId}/environments/${environment}/entries?${params.toString()}`;
}

async function fetchContentfulUrl(
  url: string,
  accessToken: string
): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok)
    throw new Error(
      `Contentful API error: ${response.status} ${response.statusText}`
    );

  const json = await response.json();

  const items = Array.isArray(json.items)
    ? json.items.filter((it: any) => it?.sys?.type === "Entry" && it?.fields)
    : [];

  return {
    ...json,
    items,
    includes: json.includes || {},
  };
}

export function getContentfulCacheStats() {
  return { hits: cacheHits, misses: cacheMisses, size: queryCache.size };
}

export function logContentfulCacheStats() {
  if (import.meta.env.DEBUG_CONTENTFUL_CACHE) {
    const stats = getContentfulCacheStats();
    console.log(
      `[Contentful cache] hits=${stats.hits} misses=${stats.misses} uniqueQueries=${stats.size}`
    );
  }
}

async function cfQuery(query: any): Promise<any> {
  const env = getEnvVars();
  const spaceId = env.CONTENTFUL_SPACE_ID;
  const accessToken = env.CONTENTFUL_DELIVERY_TOKEN;
  const environment = env.CONTENTFUL_ENVIRONMENT;

  if (!spaceId || !accessToken) {
    console.warn("Contentful environment variables not configured");
    return { items: [], total: 0, skip: 0, limit: 0, includes: {} };
  }

  const url = buildContentfulUrl(query, spaceId, environment);

  if (queryCache.has(url)) {
    cacheHits++;
    return queryCache.get(url)!;
  }

  cacheMisses++;
  const request = fetchContentfulUrl(url, accessToken).catch((error) => {
    queryCache.delete(url);
    console.error("Error fetching from Contentful:", error);
    return { items: [], total: 0, skip: 0, limit: 0, includes: {} };
  });
  queryCache.set(url, request);
  return request;
}

function mergeIncludes(target: any, source: any) {
  if (!source) return target;
  for (const key of ["Asset", "Entry"] as const) {
    if (!Array.isArray(source[key])) continue;
    if (!target[key]) target[key] = [];
    const existingIds = new Set(
      target[key].map((item: any) => item?.sys?.id).filter(Boolean)
    );
    for (const item of source[key]) {
      const id = item?.sys?.id;
      if (id && !existingIds.has(id)) {
        target[key].push(item);
        existingIds.add(id);
      }
    }
  }
  return target;
}

export async function fetchAllEntries(
  baseQuery: Record<string, any>,
  pageSize = 1000
): Promise<{ items: any[]; includes: any; total: number }> {
  let skip = 0;
  let allItems: any[] = [];
  let mergedIncludes: any = {};
  let total = 0;

  while (true) {
    const response = await cfQuery({
      ...baseQuery,
      limit: pageSize,
      skip,
    });
    const batch = response.items || [];
    allItems = allItems.concat(batch);
    mergeIncludes(mergedIncludes, response.includes);
    total = response.total ?? allItems.length;

    if (batch.length < pageSize || allItems.length >= total) {
      break;
    }
    skip += pageSize;
  }

  return { items: allItems, includes: mergedIncludes, total };
}

export function resolveAsset(link: any, includes: any) {
  if (!link || link.sys?.type === "Asset") return link; // already resolved
  if (link?.sys?.linkType !== "Asset") return null;
  const id = link.sys.id;
  return includes?.Asset?.find((a: any) => a?.sys?.id === id) ?? null;
}

// Fetch a specific asset by ID using direct API call
export async function getAsset(assetId: string) {
  try {
    const response = await fetch(
      `https://cdn.contentful.com/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}/assets/${assetId}?access_token=${CONTENTFUL_ACCESS_TOKEN}`
    );
    if (!response.ok) {
      console.error(
        "Asset fetch failed:",
        response.status,
        response.statusText
      );
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching asset:", error);
    return null;
  }
}

// Create a simple asset object from asset ID
export function createAssetFromId(assetId: string) {
  return {
    sys: {
      id: assetId,
      type: "Asset",
    },
    fields: {
      title: `${assetId} Image`,
      file: {
        url: `//images.ctfassets.net/${CONTENTFUL_SPACE_ID}/${assetId}/placeholder.jpg`,
        details: {
          size: 0,
          image: {
            width: 1200,
            height: 600,
          },
        },
        fileName: `${assetId}.jpg`,
        contentType: "image/jpeg",
      },
    },
  };
}

// Create a simple image URL from asset ID
export function createImageUrl(
  assetId: string,
  width?: number,
  height?: number
) {
  let url = `https://images.ctfassets.net/${CONTENTFUL_SPACE_ID}/${assetId}/placeholder.jpg`;

  if (width || height) {
    url += "?";
    const params = new URLSearchParams();
    if (width) params.append("w", width.toString());
    if (height) params.append("h", height.toString());
    if (width || height) params.append("fit", "thumb");
    url += params.toString();
  }

  return url;
}

// getBlogPosts
export async function getBlogPosts(params: QueryParams = {}) {
  const query: any = {
    content_type: "blogPost",
    order: params.order || ["-fields.publishDate"],
    limit: params.limit || 100,
    skip: params.skip || 0,
    include: 10, // Increased to include all referenced assets
  };
  if (params["fields.tags[in]"])
    query["fields.tags[in]"] = params["fields.tags[in]"];
  return cfQuery(query);
}

// getBlogPostBySlug
export async function getBlogPostBySlug(slug: string) {
  const response = await cfQuery({
    content_type: "blogPost",
    "fields.slug": slug,
    limit: 1,
    include: 1,
  });
  return response.items?.[0] ?? null;
}

// getRecentBlogPosts
export async function getRecentBlogPosts(limit = 5) {
  return cfQuery({
    content_type: "blogPost",
    order: ["-fields.publishDate"],
    limit,
    include: 1,
  });
}

export async function getPages(params: QueryParams = {}) {
  return cfQuery({
    content_type: "page",
    order: params.order || ["fields.title"],
    limit: params.limit || 100,
    skip: params.skip || 0,
    include: 1, // consistency
  });
}

export async function getPageBySlug(slug: string) {
  const response = await cfQuery({
    content_type: "page",
    "fields.slug": slug,
    limit: 1,
    include: 1,
  });
  return response.items?.[0] ?? null;
}

// getDailyVerses
export async function getDailyVerses(params: QueryParams = {}) {
  const query: any = {
    content_type: "dailyVerse",
    order: params.order || ["-fields.date"],
    limit: params.limit || 100,
    skip: params.skip || 0,
    include: 10,
    locale: "en-US", // Specify locale to get localized content
  };
  return cfQuery(query);
}

// getDailyVerseByDate - expects date in YYYY-MM-DD format
export async function getDailyVerseByDate(dateString: string) {
  // Contentful date fields are stored as ISO strings, so we need to query by date range
  // For exact date match, we'll query and filter
  const startOfDay = `${dateString}T00:00:00Z`;
  const endOfDay = `${dateString}T23:59:59Z`;
  
  const response = await cfQuery({
    content_type: "dailyVerse",
    "fields.date[gte]": startOfDay,
    "fields.date[lte]": endOfDay,
    limit: 1,
    include: 10,
    locale: "en-US", // Specify locale to get localized content
  });
  return response.items?.[0] ?? null;
}

// getTodayVerse - gets the verse for today's date
export async function getTodayVerse() {
  const today = new Date();
  const dateString = today.toISOString().split('T')[0];
  return getDailyVerseByDate(dateString);
}

// getRecentDailyVerses
export async function getRecentDailyVerses(limit = 5) {
  return cfQuery({
    content_type: "dailyVerse",
    order: ["-fields.date"],
    limit,
    include: 10,
    locale: "en-US", // Specify locale to get localized content
  });
}

// getResources
export async function getResources(params: QueryParams = {}) {
  const query: any = {
    content_type: "resource",
    order: params.order || ["-fields.publishDate"],
    limit: params.limit || 100,
    skip: params.skip || 0,
    include: 10, // Include assets
  };
  if (params["fields.tags[in]"])
    query["fields.tags[in]"] = params["fields.tags[in]"];
  return cfQuery(query);
}

// getResourceBySlug
export async function getResourceBySlug(slug: string) {
  const response = await cfQuery({
    content_type: "resource",
    "fields.slug": slug,
    limit: 1,
    include: 10, // Include assets
  });
  return response.items?.[0] ?? null;
}

// getRecentResources
export async function getRecentResources(limit = 5) {
  return cfQuery({
    content_type: "resource",
    order: ["-fields.publishDate"],
    limit,
    include: 10,
  });
}

// Utility functions
export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getAssetUrl(asset: any, width?: number, height?: number) {
  if (!asset?.fields?.file?.url) {
    return "";
  }

  let url = `https:${asset.fields.file.url}`;

  if (width || height) {
    url += "?";
    const params = new URLSearchParams();

    if (width) params.append("w", width.toString());
    if (height) params.append("h", height.toString());
    if (width || height) params.append("fit", "thumb");

    url += params.toString();
  }

  return url;
}
