# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Astro 6 static blog (`output: static`), Korean-language, migrated from Tistory. Deploys to GitHub Pages as a **project site** (served under the subpath `/<repo>/`, e.g. `/zzaisang-blog/`). Monetization (AdSense) and SEO (sitemap/RSS/robots/JSON-LD) are built in. Node `>=22.12` (`.nvmrc` → 22).

It is being extended from a pure blog into a **personal homepage with a portfolio** — a second `projects` content collection and `/projects` section are scaffolded (see Content model & Layout). That section is currently empty and unlinked (nav tab + homepage modules commented out pending real content).

## Commands

```bash
npm run dev      # dev server at http://localhost:4321 (may pick 4322+ if taken)
npm run build    # static build → dist/  (also the lint/typecheck gate — see below)
npm run preview  # serve the built dist/
```

There is **no test runner and no separate lint script**. `npm run build` is the verification gate: the content collection's Zod schema and Astro's strict TypeScript config (`astro/tsconfigs/strict` + `strictNullChecks`) make the build fail on bad frontmatter or type errors. Run it before considering any change done. CI (`.github/workflows/ci.yml`) runs the same build on push/PR.

**Gotcha — deleting/renaming a collection entry:** Astro persists content in `node_modules/.astro/data-store.json`, and a plain `npm run build` does **not** evict removed entries — it keeps emitting the stale pages (and their sitemap URLs), so the page count won't drop. Force a clean re-sync: `rm -rf node_modules/.astro .astro dist && npm run build`.

## Critical: base-path safety

Because the production site lives under a subpath, **every internal link must go through `withBase()`** (`src/utils/url.ts`) — never hardcode `/blog/...` in an `href`/`src`. `withBase` prefixes `import.meta.env.BASE_URL`, which comes from `PUBLIC_BASE_PATH` (see config flow below). A raw `/about` link works locally (base `/`) but 404s in production. When connecting a custom domain later, base flips back to `/` automatically.

Cross-post links **inside Markdown content** instead use relative paths (`../other-slug/`), which are base-agnostic — the migration script rewrites old Tistory URLs to this form.

## Configuration flow (env-driven, all optional)

`astro.config.mjs` reads `PUBLIC_SITE_URL` and `PUBLIC_BASE_PATH` via Vite `loadEnv`. `src/consts.ts` reads `PUBLIC_ADSENSE_*` and `PUBLIC_*_SITE_VERIFICATION` via `import.meta.env`. **Empty value = feature auto-disabled** (no ads script, no verification meta, base defaults to `/`). These are public values (exposed in page source), not secrets.

- **Local:** copy `.env.example` → `.env`.
- **Production:** the GitHub Actions deploy injects them from repo **Variables**; `PUBLIC_BASE_PATH` and `PUBLIC_SITE_URL` are auto-derived from `actions/configure-pages` (don't set them manually).

## Content model

Two glob-loaded collections, both in `src/content.config.ts` (`export const collections = { blog, projects }`); for both, **filename = URL slug** and images are **co-located** (`src/content/<collection>/<slug>/img-N.ext`, referenced relatively so Astro's image pipeline optimizes them → webp):

- **`blog`** — `src/content/blog/*.md`/`.mdx` → `/blog/<slug>/`. Zod schema: `title`, `description`, `pubDate` required; `updatedDate`, `category`, `tags[]`, `heroImage` optional. ~15 posts have image folders.
- **`projects`** — `src/content/projects/*.md` → `/projects/<slug>/`. Portfolio entries; mirrors the blog schema conventions (`z.coerce.date`, `image()` helper). Required: `title`, `summary`, `pubDate`. Optional: `role`, `techStack[]`, `projectType` (`work|personal|open-source|client`), `status` (`shipped|wip|archived`), `featured`, `order`, `repoUrl`, `demoUrl`, `writeupSlug`, `confidential` (hides source links → "요청 시 공유"), `heroImage`. Currently **empty** (only `.gitkeep` keeps the dir) — the empty glob emits a harmless build WARN until real entries are added.

## Category system

Categories are free-form strings in post frontmatter, but the taxonomy is **centralized in `src/utils/categories.ts`** — `categoryToSlug()`, `CATEGORY_ORDER`, `CATEGORY_DESCRIPTIONS`, `sortCategories()`. To add/rename/reorder categories or change a card description, edit that file. The category pages are generated:

- `src/pages/categories/index.astro` — card index (name + count + description).
- `src/pages/categories/[category]/[...page].astro` — `getStaticPaths` derives a paginated set per **distinct category found on posts**; the slug comes from `categoryToSlug`.

Consumers that must stay in sync with the slug logic: `BlogPost.astro` (clickable category pill) and `blog/[...page].astro` (card label). All link via `withBase(\`/categories/${categoryToSlug(c)}/\`)`.

The `projects` collection has a **parallel single-source-of-truth in `src/utils/projects.ts`**: `PROJECT_TYPE_LABELS`/`PROJECT_STATUS_LABELS` (Korean labels), `sortProjects()` (manual `order`, then `pubDate` desc), `featuredProjects()` (homepage slots). Edit there to change project taxonomy/ordering.

## Layout & SEO/monetization wiring

`src/layouts/BlogPost.astro` is the per-post shell: renders a 2-column shell (left sticky date/category + h2 table of contents built from the `headings` that `render()` returns; body column on the right) plus title/description/tags/slot, injects a `BlogPosting` **JSON-LD** block (pulls `articleSection` from category, `keywords` from tags), and drops an `<AdSense>` unit after the body. `src/components/BaseHead.astro` owns OG/Twitter/canonical/verification meta. Generated SEO routes: `src/pages/ads.txt.ts`, `robots.txt.ts`, `rss.xml.js`. `SOCIAL_LINKS` in `consts.ts` feeds the homepage GitHub link and the `Person` JSON-LD `sameAs` — an entry with empty `href` is skipped.

**Project pages use a *separate* `src/layouts/ProjectPost.astro` — do NOT reuse `BlogPost.astro` for them.** BlogPost injects an AdSense unit + `BlogPosting` JSON-LD, both wrong on a portfolio page; ProjectPost emits `CreativeWork` JSON-LD and no ad. `pages/projects/index.astro` (status-grouped rows) + `pages/projects/[...slug].astro` mirror the categories index/detail routing.

The homepage `src/pages/index.astro` is a real landing — one-sentence intro + link row, year-grouped recent posts, a "만든 것" featured-projects grid, and a `Person` JSON-LD block. Year-grouped post rows (`/blog`, category pages; homepage uses its `heading` mode for one labeled group) are shared via `src/components/PostList.astro`; project rows via `ProjectList.astro` (homepage, `/projects` grouped by status). Home/about/projects sections share the global `.section` grid (200px label column | content), matching the year-group rhythm. `/about` is a standalone page (not `BlogPost`) with "하는 일", a one-line-per-company career list, a stack line and "연락" (contacts from `SOCIAL_LINKS`); career facts come from the owner's resume — no internal metrics or project bullets; categories/projects live on their own pages, so do not repeat them there. **AdSense appears only on blog posts**: the `adsbygoogle.js` loader lives inside `AdSense.astro` (not `BaseHead`), and `BlogPost` renders exactly one unit at the end of the body — never add the loader globally or units to other pages.

**Design tokens** live in `src/styles/global.css` `:root` (colors as RGB triplets, redefined under `prefers-color-scheme: dark`; fonts IBM Plex Sans KR / IBM Plex Mono self-hosted via `@fontsource`). Reading-column width is the single token `--content-width: 680px`, consumed by the post/project layouts; shared body typography is the global `.prose` class. Code blocks use Shiki dual themes (`github-light`/`github-dark`, set in `astro.config.mjs`).

## Deployment

Push to `main` → `.github/workflows/deploy.yml` → Node 22 → `npm ci` → `npm run build` → upload `dist/` → Pages. The `github-pages` environment must allow the `main` branch. (Note: `README.md` mentions Vercel/Cloudflare as an option, but the live pipeline is GitHub Pages.)

## Migration script

`scripts/migrate-tistory.mjs` converts the old Tistory export (`/tmp/tistory/html/<id>.html`) to posts. It's a kept-for-reproducibility one-off; its deps (`cheerio`, `turndown`, `turndown-plugin-gfm`) are installed with `npm i --no-save` so they stay out of `package.json` / the deploy. Per-post fixups are keyed by Tistory numeric id: `SLUG_OVERRIDES` (readable English slugs) and `CATEGORY_OVERRIDES` (the 6-category mapping). It also **re-detects code-fence languages from code content** (`detectLang`/`normalizeLang`) because Tistory's original language labels are unreliable; unknown → plaintext to avoid Shiki warnings. Run `node scripts/migrate-tistory.mjs` to preview, `--write` to emit.
