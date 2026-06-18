import type { APIRoute } from 'astro';
import { withBase } from '../utils/url';

// robots.txt — 사이트맵 위치를 포함해 자동 생성됩니다.
export const GET: APIRoute = ({ site }) => {
	const sitemapUrl = new URL(withBase('/sitemap-index.xml'), site).toString();
	const body = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;
	return new Response(body, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
