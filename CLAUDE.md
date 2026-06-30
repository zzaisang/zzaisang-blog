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

`src/layouts/BlogPost.astro` is the per-post shell: renders hero/title/category pill/tags/slot, injects a `BlogPosting` **JSON-LD** block (pulls `articleSection` from category, `keywords` from tags), and drops an `<AdSense>` unit after the body. `src/components/BaseHead.astro` owns OG/Twitter/canonical/verification meta. Generated SEO routes: `src/pages/ads.txt.ts`, `robots.txt.ts`, `rss.xml.js`. Social icons render from `SOCIAL_LINKS` in `consts.ts` via `SocialLinks.astro` — an entry with empty `href` is hidden (LinkedIn is currently empty/hidden pending a URL).

**Project pages use a *separate* `src/layouts/ProjectPost.astro` — do NOT reuse `BlogPost.astro` for them.** BlogPost injects an AdSense unit + `BlogPosting` JSON-LD, both wrong on a portfolio page; ProjectPost emits `CreativeWork` JSON-LD and no ad. `pages/projects/index.astro` (card grid) + `pages/projects/[...slug].astro` mirror the categories index/detail routing.

The homepage `src/pages/index.astro` is a real landing — hero (handle + positioning + CTA) + recent posts + a `Person` JSON-LD block. Its "featured projects" and "contact" sections, plus the `Projects` nav link in `Header.astro`, are currently **commented out via `{/* … */}`** (which Astro strips from output) pending project content — grep the restore markers (e.g. `복구`) to re-enable. Card markup is shared via `src/components/{PostCard,ProjectCard}.astro`, which take a `headingLevel` prop so heading order stays correct per context.

Body **reading-column width** is a single token: `--content-width: clamp(320px, 90%, 1040px)` in `src/styles/global.css` `:root`, consumed by the `.prose` block in both `BlogPost.astro` and `ProjectPost.astro`. Retune reading width site-wide from that one line.

## Deployment

Push to `main` → `.github/workflows/deploy.yml` → Node 22 → `npm ci` → `npm run build` → upload `dist/` → Pages. The `github-pages` environment must allow the `main` branch. (Note: `README.md` mentions Vercel/Cloudflare as an option, but the live pipeline is GitHub Pages.)

## Migration script

`scripts/migrate-tistory.mjs` converts the old Tistory export (`/tmp/tistory/html/<id>.html`) to posts. It's a kept-for-reproducibility one-off; its deps (`cheerio`, `turndown`, `turndown-plugin-gfm`) are installed with `npm i --no-save` so they stay out of `package.json` / the deploy. Per-post fixups are keyed by Tistory numeric id: `SLUG_OVERRIDES` (readable English slugs) and `CATEGORY_OVERRIDES` (the 6-category mapping). It also **re-detects code-fence languages from code content** (`detectLang`/`normalizeLang`) because Tistory's original language labels are unreliable; unknown → plaintext to avoid Shiki warnings. Run `node scripts/migrate-tistory.mjs` to preview, `--write` to emit.
