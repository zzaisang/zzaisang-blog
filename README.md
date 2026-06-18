# zzaisang-blog

[Astro](https://astro.build) 기반 정적 블로그입니다. 마크다운으로 글을 쓰고 `git push` 하면 자동으로 빌드·배포되며, Google AdSense 수익화와 SEO(사이트맵·robots·RSS·구조화 데이터)가 기본 내장되어 있습니다.

## 기술 스택

- **Astro 6** — 정적 사이트 생성기(빌드 후 순수 HTML → 빠른 로딩, 광고/SEO 유리)
- **Content Collections + MDX** — 마크다운/MDX로 글 작성, 프런트매터 타입 검증
- **@astrojs/sitemap, @astrojs/rss** — 사이트맵·RSS 자동 생성
- **Google AdSense** — 환경변수만 채우면 광고 로딩 + `ads.txt` 자동 생성

## 빠른 시작

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:4321)
npm run build    # 정적 빌드 → dist/
npm run preview  # 빌드 결과 미리보기
```

## 글 쓰는 법

`src/content/blog/` 에 `.md` 또는 `.mdx` 파일을 추가합니다. 파일명이 곧 URL 슬러그가 됩니다(`my-post.md` → `/blog/my-post/`).

```markdown
---
title: '첫 번째 글'
description: '검색결과/미리보기에 노출되는 한 줄 요약'
pubDate: 2026-06-18
# updatedDate: 2026-06-20      # (선택) 수정일
# heroImage: ./cover.jpg        # (선택) 대표 이미지
---

여기에 본문을 마크다운으로 작성합니다.
```

> 프런트매터 스키마는 `src/content.config.ts` 에서 검증됩니다. 필수 필드가 빠지면 빌드가 실패하므로 오타를 즉시 잡을 수 있습니다.
> `src/content/blog/` 의 샘플 글(`first-post` 등)은 형식 참고용이니 실제 운영 전 삭제하세요.

## 설정 (환경변수)

`.env.example` 을 복사해 `.env` 를 만들고 값을 채웁니다. `.env` 는 git에 커밋되지 않습니다.

```bash
cp .env.example .env
```

| 변수 | 설명 |
|---|---|
| `PUBLIC_SITE_URL` | 배포 도메인. sitemap·canonical·RSS 절대경로에 사용 (예: `https://blog.example.com`) |
| `PUBLIC_ADSENSE_CLIENT` | AdSense 게시자 ID (`ca-pub-...`). 비우면 광고 비활성화 |
| `PUBLIC_ADSENSE_SLOT_ARTICLE` | 본문 하단 광고 단위 슬롯 ID |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | Google Search Console 소유 확인 코드 |
| `PUBLIC_NAVER_SITE_VERIFICATION` | 네이버 서치어드바이저 소유 확인 코드 |

> 이 값들은 모두 페이지 소스에 노출되는 **공개 정보**라 커밋해도 무방하지만, 환경별 분리를 위해 `.env`/배포 플랫폼 환경변수로 관리합니다. 실제 비밀키는 절대 넣지 마세요.

## AdSense 수익화

1. [AdSense](https://adsense.google.com) 에 사이트(도메인)를 **사이트 추가**로 등록합니다. (기존 계정 그대로 사용 — 계정 재심사 불필요, 사이트 단위 검토만 거침)
2. `.env` 의 `PUBLIC_ADSENSE_CLIENT` 에 게시자 ID를 넣습니다.
3. AdSense에서 **광고 단위**를 만들어 슬롯 ID를 발급받고 `PUBLIC_ADSENSE_SLOT_ARTICLE` 에 넣습니다.
4. 배포하면 `https://<도메인>/ads.txt` 가 자동 생성되어 게시자 인증이 완료됩니다.

추가 위치에 광고를 넣으려면 `<AdSense slot="슬롯ID" />` 컴포넌트(`src/components/AdSense.astro`)를 원하는 곳에 배치하세요.

> ⚠️ **정책 주의**: AI로 대량 생성한 저품질 글은 AdSense의 *Scaled content abuse* 정책 위반으로 게재 거절·정지될 수 있습니다. 자동화는 빌드·배포·SEO에 적용하고, 글 품질은 사람이 유지하세요.

## SEO

- **sitemap**: `/sitemap-index.xml` 자동 생성
- **robots.txt**: `/robots.txt` 자동 생성(sitemap 링크 포함) — `src/pages/robots.txt.ts`
- **RSS**: `/rss.xml`
- **구조화 데이터(JSON-LD)**: 글마다 `BlogPosting` 스키마 자동 삽입
- **OG/Twitter 카드, canonical**: `src/components/BaseHead.astro`
- **검색엔진 등록**: 배포 후 [Google Search Console](https://search.google.com/search-console) 과 [네이버 서치어드바이저](https://searchadvisor.naver.com) 에 사이트를 등록하고, 발급된 확인 코드를 `.env` 에 넣으세요. (네이버는 커스텀 도메인 초기 노출이 느리므로 등록을 꼭 권장)

## 배포 & 자동화

빌드 결과는 정적 파일(`dist/`)이라 어디든 올릴 수 있습니다.

- **Vercel / Cloudflare Pages (권장)**: GitHub 저장소를 연결만 하면 Astro를 자동 감지해 `git push` 시마다 빌드·배포합니다. 별도 설정 파일이 필요 없으며, 배포 환경변수(위 표)는 대시보드에 입력합니다.
- **GitHub Pages**: 무료. 전용 배포 워크플로가 필요하니 원하면 추가해 드립니다.

`.github/workflows/ci.yml` 는 push/PR마다 빌드가 깨지지 않는지 검증합니다.

## 커스터마이징 체크리스트

- [ ] `src/consts.ts` — 사이트 제목/설명/작성자
- [ ] `src/components/Header.astro` — 네비게이션·소셜 링크(현재 Astro 공식 계정)를 본인 것으로 교체
- [ ] `src/components/Footer.astro` — 푸터 문구
- [ ] `src/content/blog/` — 샘플 글 삭제 후 실제 글 작성
- [ ] `.env` — 도메인·AdSense·검색엔진 인증 값
- [ ] `public/favicon.svg` — 파비콘

## 디렉터리 구조

```
src/
├─ components/        # BaseHead, Header, Footer, AdSense ...
├─ content/blog/      # 블로그 글(.md/.mdx)
├─ layouts/           # BlogPost.astro (글 레이아웃 + JSON-LD + 광고)
├─ pages/             # 라우트(index, blog/, ads.txt, robots.txt, rss.xml)
├─ consts.ts          # 사이트 전역 설정
└─ content.config.ts  # 프런트매터 스키마
```
