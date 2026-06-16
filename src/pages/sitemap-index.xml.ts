import { getBlogPosts, getResources, getDailyVerses } from '../lib/contentful';

export async function GET() {
  const baseUrl = 'https://howgodspeakstous.com';

  try {
    const [postsResponse, resourcesResponse, versesResponse] = await Promise.all([
      getBlogPosts({ limit: 1000 }),
      getResources({ limit: 1000 }),
      getDailyVerses({ limit: 1000 }),
    ]);

    const posts = (postsResponse.items || [])
      .filter((post: any) => post?.sys?.type === 'Entry' && post?.fields && post.fields.title && post.fields.slug);

    const resources = (resourcesResponse.items || [])
      .filter((resource: any) => resource?.sys?.type === 'Entry' && resource?.fields && resource.fields.title && resource.fields.slug);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];

    const verses = (versesResponse.items || [])
      .filter((verse: any) => verse?.sys?.type === 'Entry' && verse?.fields?.date && verse?.fields?.verse)
      .map((verse: any) => ({
        ...verse,
        dateString: new Date(verse.fields.date).toISOString().split('T')[0],
      }))
      .filter((verse: any) => verse.dateString <= todayString);

    const staticPages = [
      { url: '', priority: '1.0', changefreq: 'weekly' },
      { url: '/blog', priority: '0.9', changefreq: 'daily' },
      { url: '/daily-verses', priority: '0.9', changefreq: 'daily' },
      { url: '/resources', priority: '0.9', changefreq: 'weekly' },
      { url: '/about', priority: '0.8', changefreq: 'monthly' },
      { url: '/contact', priority: '0.7', changefreq: 'monthly' },
    ];

    const blogPages = posts.map((post: any) => ({
      url: `/blog/${post.fields.slug}`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: post.fields.publishDate || post.sys.updatedAt,
    }));

    const resourcePages = resources.map((resource: any) => ({
      url: `/resources/${resource.fields.slug}`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: resource.fields.publishDate || resource.sys.updatedAt,
    }));

    const versePages = verses.map((verse: any) => ({
      url: `/daily-verses/${verse.dateString}`,
      priority: '0.7',
      changefreq: 'monthly',
      lastmod: verse.fields.date || verse.sys.updatedAt,
    }));

    const allPages = [...staticPages, ...blogPages, ...resourcePages, ...versePages];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${page.lastmod ? new Date(page.lastmod).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response('Error generating sitemap', { status: 500 });
  }
}
