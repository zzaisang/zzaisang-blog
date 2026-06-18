// Tistory → Astro 마이그레이션 스크립트
//
// 사용법:
//   설치(1회): npm install --no-save cheerio turndown turndown-plugin-gfm
//   미리보기:   node scripts/migrate-tistory.mjs            (manifest 출력만)
//   실제 변환:  node scripts/migrate-tistory.mjs --write    (마크다운+이미지 생성)
//
// 입력: /tmp/tistory/html/<id>.html  (sitemap에서 받은 원본 글 HTML)
// 출력: src/content/blog/<slug>.md  (+ 이미지가 있으면 src/content/blog/<slug>/img-N.ext)

import { load } from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const HTML_DIR = '/tmp/tistory/html';
const OUT_DIR = 'src/content/blog';
const BLOG_BASE = 'https://kim-zzaisang.tistory.com';
const WRITE = process.argv.includes('--write');

// 한글 위주 제목 등 자동 슬러그가 약한 글은 여기서 수동 지정 (id -> slug)
const SLUG_OVERRIDES = {
	2: 'java8-list-remove-duplicates',
	3: 'java8-list-find-duplicates',
	4: 'spring-boot-project-setup',
	5: 'connect-local-project-to-github',
	6: 'spring-requestparam-enum',
	7: 'mac-m1-docker-install',
	8: 'jvm-memory-structure',
	9: 'solid-principles',
	10: 'delete-ds-store',
	14: 'garbage-collection',
	15: 'java-execution-process-jvm',
	17: 'oop-characteristics',
	20: 'java-generics',
	23: 'process-vs-thread',
	27: 'mongodb-find-data',
	28: 'github-ssh-multiple-keys',
	29: 'what-is-dsl',
	30: 'rabbitmq-docker-install',
	31: 'ec2-amazon-linux2-docker-install',
	32: 'mongodb-query-by-date',
	34: 'transaction-acid',
	36: 'what-is-mariadb',
	37: 'what-is-postgresql',
	39: 'spring-run-without-datasource',
	40: 'remove-openjdk-vm-warning',
	41: 'spring-jpa-reserved-keyword-column',
	42: 'spring-env-to-yaml',
	43: 'postgresql-vs-mariadb',
	44: 'uuid-versions',
	45: 'aws-cli-install',
	48: 'postgresql-table-truncate-with-sequence',
};

// 카테고리 재분류: Tistory의 잘게 쪼개진 분류를 깔끔한 6개 상위 카테고리로 재판단 (id -> category)
const CATEGORY_OVERRIDES = {
	2: 'Java/Kotlin', 3: 'Java/Kotlin', 8: 'Java/Kotlin', 14: 'Java/Kotlin', 15: 'Java/Kotlin', 20: 'Java/Kotlin', 22: 'Java/Kotlin', 49: 'Java/Kotlin',
	4: 'Spring', 6: 'Spring', 16: 'Spring', 35: 'Spring', 39: 'Spring', 40: 'Spring', 41: 'Spring', 42: 'Spring', 51: 'Spring', 52: 'Spring',
	25: 'Database', 26: 'Database', 27: 'Database', 32: 'Database', 33: 'Database', 34: 'Database', 36: 'Database', 37: 'Database', 38: 'Database', 43: 'Database', 47: 'Database', 48: 'Database',
	7: 'DevOps', 30: 'DevOps', 31: 'DevOps', 45: 'DevOps', 46: 'DevOps',
	9: 'CS', 17: 'CS', 18: 'CS', 19: 'CS', 21: 'CS', 23: 'CS', 24: 'CS', 44: 'CS',
	5: 'ETC', 10: 'ETC', 28: 'ETC', 29: 'ETC',
};

// ---------- 유틸 ----------
function autoSlug(title) {
	const tokens = (title || '').toLowerCase().match(/[a-z0-9]+/g) || [];
	return tokens.join('-');
}

function cleanText(s) {
	return (s || '').replace(/\s+/g, ' ').trim();
}

function makeDescription($, content) {
	const clone = content.clone();
	clone.find('pre, code, img, figure, table').remove();
	let text = cleanText(clone.text());
	if (text.length <= 157) return text;
	let cut = text.slice(0, 157);
	const lastSpace = cut.lastIndexOf(' ');
	if (lastSpace > 80) cut = cut.slice(0, lastSpace);
	return cut.trim() + '…';
}

function extExtract(url) {
	const path = url.split('?')[0];
	const m = path.match(/\.([a-zA-Z0-9]{1,5})$/);
	const e = m ? m[1].toLowerCase() : 'jpg';
	return e === 'jpeg' ? 'jpg' : e;
}

// Tistory가 자동 감지로 붙인 코드 언어 라벨은 신뢰할 수 없어(같은 라벨이 블록마다 다른 언어),
// 코드 '내용'으로 고정밀 재탐지한다. 확신이 없으면 빈 문자열(plaintext) — 잘못된 강조보다 안전.
function detectLang(code) {
	const c = code.trim();
	const head = c.split('\n').slice(0, 6).join('\n');
	if (/^\s*\$[ \t]/m.test(c) || /^\s*(sudo|docker|docker-compose|podman|aws|brew|kubectl|npm|yarn|pnpm|git|cd|ls|cat|mkdir|chmod|curl|wget|export|echo|javac?|gradle|\.\/gradlew|psql|mysql|mongo|mongosh)\b/m.test(head))
		return 'bash';
	if (/\b(SELECT|INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|CREATE\s+(TABLE|DATABASE|INDEX|SEQUENCE)|ALTER\s+TABLE|TRUNCATE\b|DROP\s+(TABLE|DATABASE))\b/i.test(c))
		return 'sql';
	if (/^\s*(version|services|apiVersion|kind|spring|server|management|volumes|networks):\s*/m.test(c) && /^[ \t]*[\w-]+:\s*/m.test(c))
		return 'yaml';
	if (/\b(fun|val|var)\b/.test(c) && /(fun\s+\w+\s*\(|val\s+\w+\s*[:=]|::class|override\s+fun|\.map\s*\{|\.let\s*\{|companion\s+object)/.test(c))
		return 'kotlin';
	if (/\b(public|private|protected)\s+(class|interface|enum|static|final|abstract|void|int|long|String|boolean)\b/.test(c) || /System\.out\.print|import\s+java\.|@Override|@Component|@Service|@Autowired/.test(c))
		return 'java';
	if (/^\s*[{[]/.test(c) && /"[\w-]+"\s*:/.test(c) && !/\bdb\.|=>|\bfun\b/.test(c) && !/<\w+>/.test(c))
		return 'json';
	if (/\bdb\.\w+\.\w+\s*\(|=>|\bconst\s+\w+\s*=|\blet\s+\w+\s*=|console\.log/.test(c))
		return 'javascript';
	if (/^[ \t]*[\w.][\w.-]*\s*=\s*\S/m.test(c) && !/[;{}()]/.test(head)) return 'properties';
	return '';
}

// 탐지 실패 시: 원본 라벨이 '대체로 신뢰 가능한' 것이면 유지, 아니면 plaintext.
const SAFE_KEEP = new Set(['java', 'kotlin', 'javascript', 'typescript', 'bash', 'shell', 'sql', 'yaml', 'json', 'css', 'groovy', 'properties', 'xml', 'html', 'go', 'python', 'cpp']);
function normalizeLang(code, original) {
	const detected = detectLang(code);
	if (detected) return detected;
	const o = (original || '').toLowerCase();
	if (!o || o === 'undefined' || o === 'plain') return '';
	return SAFE_KEEP.has(o) ? o : '';
}

// ---------- turndown 설정 ----------
const td = new TurndownService({
	headingStyle: 'atx',
	codeBlockStyle: 'fenced',
	bulletListMarker: '-',
	emDelimiter: '*',
	hr: '---',
});
td.use(gfm);

// Tistory 코드블록: <pre class="kotlin"><code>...</code></pre> → ```kotlin ... ```
td.addRule('tistoryCode', {
	filter: (node) => node.nodeName === 'PRE',
	replacement: (_content, node) => {
		const original = (node.getAttribute('class') || '').trim().split(/\s+/)[0].toLowerCase();
		const code = (node.textContent || '').replace(/\n+$/, '');
		const lang = normalizeLang(code, original);
		return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
	},
});

// ---------- 본문 추출 ----------
function extractPost(id) {
	const $ = load(readFileSync(join(HTML_DIR, `${id}.html`), 'utf-8'));
	const title = cleanText($('meta[property="og:title"]').attr('content') || $('title').text());
	const published = $('meta[property="article:published_time"]').attr('content') || null;
	const modified = $('meta[property="article:modified_time"]').attr('content') || null;

	let content = $('.tt_article_useless_p_margin').first();
	if (!content.length) content = $('.entry-content').first();
	if (!content.length) content = $('.article-view').first();

	// 태그: 글 태그만 (rel=tag), 사이드바 태그클라우드 제외
	const tags = [...new Set($('a[rel=tag]').map((i, e) => cleanText($(e).text())).get().filter(Boolean))];

	// 카테고리: .category 첫 요소가 글 분류 경로(예: Spring/Spring Cloud) — 사이드바 트리는 제외
	let category = null;
	const catRaw = cleanText($('.category').first().text());
	if (catRaw && !catRaw.includes('분류 전체보기') && catRaw !== '카테고리 없음' && catRaw.length < 40) category = catRaw;
	if (CATEGORY_OVERRIDES[id]) category = CATEGORY_OVERRIDES[id]; // 재분류 우선 적용

	const imgs = content.find('img');

	return { id, title, published, modified, content, $, tags, category, imgCount: imgs.length };
}

// ---------- 슬러그 확정(중복 회피) ----------
const ids = readdirSync(HTML_DIR).map((f) => parseInt(f)).filter(Boolean).sort((a, b) => a - b);
const posts = ids.map(extractPost);
const usedSlugs = new Set();
for (const p of posts) {
	let slug = SLUG_OVERRIDES[p.id] || autoSlug(p.title);
	if (!slug || slug.length < 2) slug = `post-${p.id}`;
	if (usedSlugs.has(slug)) slug = `${slug}-${p.id}`;
	usedSlugs.add(slug);
	p.slug = slug;
}
// 내부 글 링크(Tistory 절대주소) → 새 블로그 상대경로 매핑용
const idToSlug = new Map(posts.map((p) => [p.id, p.slug]));

// ---------- manifest 모드 ----------
if (!WRITE) {
	console.log(`총 ${posts.length}개 글\n`);
	console.log('ID  | DATE       | IMG | TAGS(n) | SLUG ⟵ TITLE');
	console.log('-'.repeat(100));
	for (const p of posts) {
		const date = (p.published || '????').slice(0, 10);
		const weak = !/[a-z]{3,}/.test(p.slug) || p.slug.startsWith('post-') ? ' ⚠️WEAK' : '';
		console.log(`${String(p.id).padStart(3)} | ${date} | ${String(p.imgCount).padStart(2)}  | ${String(p.tags.length).padStart(2)}      | ${p.slug}${weak}  ⟵  ${p.title}`);
	}
	console.log('\n⚠️WEAK = 자동 슬러그가 약함(한글 위주). SLUG_OVERRIDES 로 보정 권장.');
	console.log('카테고리 예시:', [...new Set(posts.map((p) => p.category).filter(Boolean))].join(', '));
	process.exit(0);
}

// ---------- 쓰기 모드 ----------
async function downloadImage(url, destPath) {
	const res = await fetch(url, {
		headers: { 'User-Agent': 'Mozilla/5.0', Referer: BLOG_BASE },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	writeFileSync(destPath, buf);
	return buf.length;
}

function yamlString(s) {
	return JSON.stringify(s ?? '');
}

let written = 0,
	imgOk = 0,
	imgFail = 0;

for (const p of posts) {
	const { content, $ } = p;

	// pre 안의 <br> → 줄바꿈 (코드 줄 보존)
	content.find('pre br').replaceWith('\n');

	// 이미지 처리: 다운로드 후 상대경로로 치환
	const images = content.find('img').toArray();
	let imgIndex = 0;
	if (images.length) mkdirSync(join(OUT_DIR, p.slug), { recursive: true });
	for (const el of images) {
		const $el = $(el);
		const src = $el.attr('data-url') || $el.attr('src') || '';
		if (!src) {
			$el.remove();
			continue;
		}
		imgIndex++;
		const fname = `img-${imgIndex}.${extExtract(src)}`;
		const dest = join(OUT_DIR, p.slug, fname);
		try {
			if (!existsSync(dest)) await downloadImage(src.startsWith('//') ? 'https:' + src : src, dest);
			imgOk++;
			// alt 보존, 상대경로로 교체
			const alt = cleanText($el.attr('alt') || '');
			$el.attr('src', `./${p.slug}/${fname}`);
			$el.removeAttr('data-url');
			$el.removeAttr('srcset');
			$el.removeAttr('width');
			$el.removeAttr('height');
			$el.attr('alt', alt);
		} catch (err) {
			imgFail++;
			console.warn(`  ! [${p.id}] 이미지 실패 ${fname}: ${err.message} (${src.slice(0, 60)})`);
			$el.remove();
		}
	}

	// HTML → 마크다운
	let md = td.turndown($.html(content));
	// 내부 글 링크(Tistory 절대주소)를 새 블로그 상대경로로 — base-path 안전
	md = md.replace(/https?:\/\/kim-zzaisang\.tistory\.com\/(\d+)\b\/?/g, (m, pid) => {
		const s = idToSlug.get(parseInt(pid));
		return s ? `../${s}/` : m;
	});
	md = md.replace(/\n{3,}/g, '\n\n').trim() + '\n';

	// updatedDate: 발행일과 '날짜(YYYY-MM-DD)'가 다를 때만 기록
	let updated = null;
	if (p.modified && p.published && p.modified.slice(0, 10) !== p.published.slice(0, 10)) {
		updated = p.modified;
	}

	const fm = [
		'---',
		`title: ${yamlString(p.title)}`,
		`description: ${yamlString(makeDescription($, content))}`,
		`pubDate: ${yamlString(p.published)}`,
		...(updated ? [`updatedDate: ${yamlString(updated)}`] : []),
		...(p.category ? [`category: ${yamlString(p.category)}`] : []),
		...(p.tags.length ? [`tags: [${p.tags.map(yamlString).join(', ')}]`] : []),
		'---',
		'',
	].join('\n');

	writeFileSync(join(OUT_DIR, `${p.slug}.md`), fm + md);
	written++;
}

console.log(`\n완료: 글 ${written}개 작성, 이미지 ${imgOk} 성공 / ${imgFail} 실패`);
