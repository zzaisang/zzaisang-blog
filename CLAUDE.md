# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Astro 6 static blog (`output: static`), Korean-language, migrated from Tistory. Deploys to GitHub Pages as a **project site** (served under the subpath `/<repo>/`, e.g. `/zzaisang-blog/`). Monetization (AdSense) and SEO (sitemap/RSS/robots/JSON-LD) are built in. Node `>=22.12` (`.nvmrc` → 22).

## Commands

```bash
npm run dev      # dev server at http://localhost:4321 (may pick 4322+ if taken)
npm run build    # static build → dist/  (also the lint/typecheck gate — see below)
npm run preview  # serve the built dist/
```

There is **no test runner and no separate lint script**. `npm run build` is the verification gate: the content collection's Zod schema and Astro's strict TypeScript config (`astro/tsconfigs/strict` + `strictNullChecks`) make the build fail on bad frontmatter or type errors. Run it before considering any change done. CI (`.github/workflows/ci.yml`) runs the same build on push/PR.

## Critical: base-path safety

Because the production site lives under a subpath, **every internal link must go through `withBase()`** (`src/utils/url.ts`) — never hardcode `/blog/...` in an `href`/`src`. `withBase` prefixes `import.meta.env.BASE_URL`, which comes from `PUBLIC_BASE_PATH` (see config flow below). A raw `/about` link works locally (base `/`) but 404s in production. When connecting a custom domain later, base flips back to `/` automatically.

Cross-post links **inside Markdown content** instead use relative paths (`../other-slug/`), which are base-agnostic — the migration script rewrites old Tistory URLs to this form.

## Configuration flow (env-driven, all optional)

`astro.config.mjs` reads `PUBLIC_SITE_URL` and `PUBLIC_BASE_PATH` via Vite `loadEnv`. `src/consts.ts` reads `PUBLIC_ADSENSE_*` and `PUBLIC_*_SITE_VERIFICATION` via `import.meta.env`. **Empty value = feature auto-disabled** (no ads script, no verification meta, base defaults to `/`). These are public values (exposed in page source), not secrets.

- **Local:** copy `.env.example` → `.env`.
- **Production:** the GitHub Actions deploy injects them from repo **Variables**; `PUBLIC_BASE_PATH` and `PUBLIC_SITE_URL` are auto-derived from `actions/configure-pages` (don't set them manually).

## Content model

Posts live in `src/content/blog/` as `.md`/`.mdx`; **filename = URL slug** (`foo.md` → `/blog/foo/`). The collection (`src/content.config.ts`) uses the glob loader and this Zod schema: `title`, `description`, `pubDate` required; `updatedDate`, `category`, `tags[]`, `heroImage` optional.

Post images are **co-located**: `src/content/blog/<slug>/img-N.ext`, referenced relatively from the `.md` so Astro's image pipeline optimizes them (→ webp). ~15 posts have image folders.

## Category system

Categories are free-form strings in post frontmatter, but the taxonomy is **centralized in `src/utils/categories.ts`** — `categoryToSlug()`, `CATEGORY_ORDER`, `CATEGORY_DESCRIPTIONS`, `sortCategories()`. To add/rename/reorder categories or change a card description, edit that file. The category pages are generated:

- `src/pages/categories/index.astro` — card index (name + count + description).
- `src/pages/categories/[category].astro` — `getStaticPaths` derives one page per **distinct category found on posts**; the slug comes from `categoryToSlug`.

Consumers that must stay in sync with the slug logic: `BlogPost.astro` (clickable category pill) and `blog/index.astro` (card label). All link via `withBase(\`/categories/${categoryToSlug(c)}/\`)`.

## Layout & SEO/monetization wiring

`src/layouts/BlogPost.astro` is the per-post shell: renders hero/title/category pill/tags/slot, injects a `BlogPosting` **JSON-LD** block (pulls `articleSection` from category, `keywords` from tags), and drops an `<AdSense>` unit after the body. `src/components/BaseHead.astro` owns OG/Twitter/canonical/verification meta. Generated SEO routes: `src/pages/ads.txt.ts`, `robots.txt.ts`, `rss.xml.js`. Social icons render from `SOCIAL_LINKS` in `consts.ts` via `SocialLinks.astro` — an entry with empty `href` is hidden (LinkedIn is currently empty/hidden pending a URL).

## Deployment

Push to `main` → `.github/workflows/deploy.yml` → Node 22 → `npm ci` → `npm run build` → upload `dist/` → Pages. The `github-pages` environment must allow the `main` branch. (Note: `README.md` mentions Vercel/Cloudflare as an option, but the live pipeline is GitHub Pages.)

## Migration script

`scripts/migrate-tistory.mjs` converts the old Tistory export (`/tmp/tistory/html/<id>.html`) to posts. It's a kept-for-reproducibility one-off; its deps (`cheerio`, `turndown`, `turndown-plugin-gfm`) are installed with `npm i --no-save` so they stay out of `package.json` / the deploy. Per-post fixups are keyed by Tistory numeric id: `SLUG_OVERRIDES` (readable English slugs) and `CATEGORY_OVERRIDES` (the 6-category mapping). It also **re-detects code-fence languages from code content** (`detectLang`/`normalizeLang`) because Tistory's original language labels are unreliable; unknown → plaintext to avoid Shiki warnings. Run `node scripts/migrate-tistory.mjs` to preview, `--write` to emit.
