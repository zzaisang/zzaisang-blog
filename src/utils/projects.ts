// 프로젝트 타입·상태 라벨과 정렬을 한 곳에서 관리합니다. (categories.ts 와 같은 단일 출처 패턴)
import type { CollectionEntry } from 'astro:content';

type Project = CollectionEntry<'projects'>;

// 카드/상세에 노출할 한글 라벨.
export const PROJECT_TYPE_LABELS: Record<string, string> = {
	work: '실무',
	personal: '사이드',
	'open-source': '오픈소스',
	client: '클라이언트',
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
	shipped: '운영',
	wip: '진행 중',
	archived: '보관',
};

// order(있으면) 오름차순 → pubDate 내림차순으로 정렬합니다.
export function sortProjects(projects: Project[]): Project[] {
	return [...projects].sort((a, b) => {
		const oa = a.data.order ?? Number.POSITIVE_INFINITY;
		const ob = b.data.order ?? Number.POSITIVE_INFINITY;
		if (oa !== ob) return oa - ob;
		return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
	});
}

// 홈에 노출할 대표 프로젝트(featured) 상위 N개.
export function featuredProjects(projects: Project[], limit = 3): Project[] {
	return sortProjects(projects.filter((p) => p.data.featured)).slice(0, limit);
}
