import type { APIRoute } from 'astro';
import { ADSENSE_CLIENT } from '../consts';

// ads.txt — AdSense 게시자 인증 파일. PUBLIC_ADSENSE_CLIENT 설정 시 자동 생성됩니다.
// 형식: google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
export const GET: APIRoute = () => {
	const publisherId = ADSENSE_CLIENT.replace(/^ca-/, '');
	const body = publisherId ? `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n` : '';
	return new Response(body, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
