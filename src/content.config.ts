import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			category: z.string().optional(),
			tags: z.array(z.string()).optional(),
			heroImage: z.optional(image()),
		}),
});

const projects = defineCollection({
	// Load Markdown and MDX files in the `src/content/projects/` directory.
	loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
	// 포트폴리오 항목 스키마. blog 컨벤션(z.coerce.date·image())을 그대로 따릅니다.
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			// 카드용 한두 문장 요약. 상세 페이지의 meta description 으로도 쓰입니다.
			summary: z.string(),
			// 이 프로젝트에서 '내가' 한 역할 (예: 'Backend + CI/CD'). 팀/실무 프로젝트에 특히 중요.
			role: z.string().optional(),
			// 정렬 기준 키 (blog 의 pubDate 와 동일 규칙).
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			techStack: z.array(z.string()).default([]),
			projectType: z.enum(['work', 'personal', 'open-source', 'client']).default('personal'),
			status: z.enum(['shipped', 'wip', 'archived']).default('shipped'),
			// 홈 '대표 프로젝트' 슬롯 노출 여부.
			featured: z.boolean().default(false),
			// /projects 인덱스의 수동 정렬 키 (작을수록 앞).
			order: z.number().optional(),
			teamSize: z.string().optional(),
			repoUrl: z.string().url().optional(),
			demoUrl: z.string().url().optional(),
			// 관련 블로그 글 슬러그 (있으면 상세 페이지에서 글로 연결). 예: 'flyway-ci-guard'
			writeupSlug: z.string().optional(),
			// true 면 소스 링크를 숨기고 'NDA/요청 시 공유' 로 표시 (회사·실무 프로젝트용).
			confidential: z.boolean().default(false),
			heroImage: z.optional(image()),
		}),
});

export const collections = { blog, projects };
