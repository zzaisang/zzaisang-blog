// Place any global data in this file.
// 이 파일의 값은 어디서든 `import` 로 가져와 사용합니다.
//
// 주의: 여기에는 "공개되어도 안전한" 값만 둡니다.
// AdSense 게시자 ID·검색엔진 인증 코드는 페이지 소스에 그대로 노출되는 공개 정보이므로 무방합니다.
// 실제 비밀 값(토큰·API 키 등)은 절대 두지 말고 .env 를 사용하세요. (.env 는 git 에 커밋되지 않습니다)

export const SITE_TITLE = 'zzaisang';
export const SITE_DESCRIPTION = '개발과 일상을 기록하는 zzaisang의 블로그';
export const SITE_AUTHOR = 'zzaisang';
export const SITE_LANG = 'ko';

// 목록 페이지(블로그·카테고리) 한 페이지당 글 수.
export const POSTS_PER_PAGE = 10;

// 수익화 / 검색엔진 인증 — .env 의 PUBLIC_* 값으로 주입됩니다(값이 없으면 자동 비활성화).
export const ADSENSE_CLIENT = import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '';
export const ADSENSE_SLOT_ARTICLE = import.meta.env.PUBLIC_ADSENSE_SLOT_ARTICLE ?? '';
// Google 인증 값은 공개 값이라 기본값을 고정합니다(env 가 있으면 그 값이 우선).
export const GOOGLE_SITE_VERIFICATION =
	import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION || 'FHdTysnAkP5A8FtQK9382HCnPty8Z5kkyJ7G_As_jSI';
// AdSense 계정 인증 메타(google-adsense-account). 광고 로더와 무관하게 전 페이지 head 에 들어갑니다.
export const GOOGLE_ADSENSE_ACCOUNT = 'ca-pub-8697100272441762';
export const NAVER_SITE_VERIFICATION = import.meta.env.PUBLIC_NAVER_SITE_VERIFICATION ?? '';

// 소셜 링크 — href 가 비어 있으면 자동으로 숨겨집니다. 푸터·소개 연락에 함께 쓰입니다.
// mailto: 링크는 새 탭으로 열지 않고, Person JSON-LD 의 sameAs(프로필 URL)에서도 빠집니다.
export const SOCIAL_LINKS = [
	{ name: 'GitHub', icon: 'github', href: 'https://github.com/zzaisang' },
	{ name: 'Email', icon: 'email', href: 'mailto:dev.zzaisang@gmail.com' },
	{ name: 'LinkedIn', icon: 'linkedin', href: '' }, // TODO: LinkedIn 프로필 URL 입력 시 자동 표시됩니다
];
