// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const { PUBLIC_SITE_URL, PUBLIC_BASE_PATH } = loadEnv(
	process.env.NODE_ENV ?? 'production',
	process.cwd(),
	'PUBLIC_',
);

// https://astro.build/config
export default defineConfig({
	site: PUBLIC_SITE_URL || 'https://example.com',
	base: PUBLIC_BASE_PATH || '/',
	integrations: [mdx(), sitemap()],
	// 코드블록 듀얼 테마 — 라이트는 github-light, 다크는 기존 github-dark.
	// 다크 전환은 global.css 의 prefers-color-scheme 규칙이 --shiki-dark 변수로 처리합니다.
	markdown: {
		shikiConfig: {
			themes: { light: 'github-light', dark: 'github-dark' },
		},
	},
});
