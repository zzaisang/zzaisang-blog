/// <reference types="astro/client" />

interface ImportMetaEnv {
	/** 사이트 정식 URL (예: https://blog.example.com) */
	readonly PUBLIC_SITE_URL?: string;
	/** Google AdSense 게시자 ID (예: ca-pub-0000000000000000) */
	readonly PUBLIC_ADSENSE_CLIENT?: string;
	/** 본문 하단 광고 단위 슬롯 ID */
	readonly PUBLIC_ADSENSE_SLOT_ARTICLE?: string;
	/** Google Search Console 소유 확인 코드 */
	readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
	/** 네이버 서치어드바이저 소유 확인 코드 */
	readonly PUBLIC_NAVER_SITE_VERIFICATION?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
