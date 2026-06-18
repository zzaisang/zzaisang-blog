// 사이트 내부 링크에 base 경로를 안전하게 붙이는 헬퍼.
// import.meta.env.BASE_URL 은 설정에 따라 끝에 '/' 가 있을 수도/없을 수도 있어 정규화한다.
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** 내부 경로에 base 를 붙여 반환한다. 예) withBase('/blog') → '/repo/blog' (base 없으면 '/blog') */
export function withBase(path = '/') {
	const clean = path.startsWith('/') ? path : `/${path}`;
	return `${base}${clean}` || '/';
}
