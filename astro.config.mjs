// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
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
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			// Atkinson 에는 한글 글리프가 없어 한글은 폴백 폰트로 그려집니다.
			// OS별 한글 시스템 폰트를 명시해 환경마다 들쭉날쭉한 기본 고딕을 막습니다.
			fallbacks: [
				'-apple-system',
				'BlinkMacSystemFont',
				'Apple SD Gothic Neo',
				'Malgun Gothic',
				'Noto Sans KR',
				'sans-serif',
			],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
