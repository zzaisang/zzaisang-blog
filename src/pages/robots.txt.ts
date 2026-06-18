import type { APIRoute } from 'astro';

// robots.txt — 사이트맵 위치를 포함해 자동 생성됩니다.
export const GET: APIRoute = ({ site }) => {
	const sitemapUrl = new URL('sitemap-index.xml', site).toString();
	const body = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;
	return new Response(body, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
