// 카테고리 라벨의 URL 슬러그·표시 순서·설명을 한 곳에서 관리합니다.

// "Java/Kotlin" → "java-kotlin", "CS" → "cs"
export function categoryToSlug(category: string): string {
	return category
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

// 인덱스·메뉴에서의 표시 순서. 목록에 없는 카테고리는 뒤에 이름순으로 붙습니다.
export const CATEGORY_ORDER = ['Java/Kotlin', 'Spring', 'Database', 'DevOps', 'CS', 'ETC'];

// 인덱스 카드용 한 줄 설명 (없으면 생략됩니다).
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
	'Java/Kotlin': 'JVM 언어와 내부 구조',
	Spring: 'Spring 프레임워크와 생태계',
	Database: 'MongoDB·RDBMS와 데이터 다루기',
	DevOps: '컨테이너·클라우드·인프라',
	CS: '객체지향·동시성·기초 이론',
	ETC: '도구와 환경 설정',
};

// CATEGORY_ORDER 우선, 그 외는 이름순으로 정렬합니다.
export function sortCategories(cats: string[]): string[] {
	return [...cats].sort((a, b) => {
		const ia = CATEGORY_ORDER.indexOf(a);
		const ib = CATEGORY_ORDER.indexOf(b);
		if (ia === -1 && ib === -1) return a.localeCompare(b);
		if (ia === -1) return 1;
		if (ib === -1) return -1;
		return ia - ib;
	});
}
