# SEO Standard

**Purpose:** This standard defines the baseline practices every page on our site should meet before and after publishing. It's built around Google's Search Essentials guidance, translated into concrete rules our team can check against rather than general advice.

**Scope:** Applies to all public-facing pages, blog/content posts, and product/service pages.

---

## 1. Crawlability & Indexability (Technical Baseline)

- [ ] Page is not accidentally blocked from crawling or indexing (check `robots.txt` and any `noindex` tags before publishing anything meant to be public).
- [ ] Page renders the same content and layout for a crawler as it does for a real visitor — don't hide critical CSS/JS from crawlers, since that can prevent the page from being understood or ranked properly.
- [ ] If content varies by visitor location, confirm the US-based version (the default crawl location) is still accurate and complete.
- [ ] New or updated pages are reachable via at least one internal link — don't rely solely on a sitemap to surface a page.
- [ ] Sitemap is kept current for large sections of the site (optional for small sites, but required once a section exceeds a few hundred URLs).
- [ ] Pages intentionally excluded from search (drafts, internal tools, duplicate variants) use a deliberate opt-out method (`noindex`, disallow, or auth-gating) — not left to chance.

## 2. URL & Site Structure

- [ ] URLs are descriptive and human-readable (e.g. `/pets/cats` rather than an opaque ID string). Words in the URL should help a user judge relevance from the search result alone.
- [ ] Related content is grouped under consistent directories/paths so crawl patterns and update frequency can be reasoned about at the section level (e.g. all policy pages under one path, all promotional pages under another).
- [ ] Every distinct piece of content is reachable through exactly one canonical URL. Where duplicates are unavoidable (e.g. filtered/sorted views), a preferred version is set via redirect or `rel="canonical"`.
- [ ] Avoid publishing near-duplicate pages that could confuse a visitor about which one is "the real page."

## 3. Content Standards

- [ ] Content is original — written from our own knowledge/expertise, not rehashed or lightly reworded from other sources.
- [ ] Content is well organized: clear paragraphs, section headings, and a logical reading order.
- [ ] Content is proofread — free of spelling and grammatical errors before publishing.
- [ ] Content reflects current information; outdated pages are updated or retired on a regular review cycle rather than left stale indefinitely.
- [ ] Writing anticipates how different readers phrase their search intent (e.g. a beginner vs. an expert on the same topic) — this is a writing consideration, not a request to stuff in every possible keyword variant.
- [ ] There is no fixed word-count target. Depth and clarity matter more than length; don't pad content to hit a number.

## 4. On-Page Elements

- [ ] **Title tag**: unique per page, clear, concise, and accurately describes the page's content.
- [ ] **Meta description**: a short, unique one-to-two sentence summary of the page's most relevant points. Written per-page, not templated boilerplate.
- [ ] **Images**: high quality, placed near the text they're relevant to (not dropped in an unrelated gallery), and include descriptive `alt` text that explains what the image is and its relevance to the surrounding content.
- [ ] **Video**: hosted on a standalone page near relevant text, with a descriptive title and description field (same title-writing standard as above applies).

## 5. Linking Standards

- [ ] Internal links connect users and crawlers to other relevant parts of the site.
- [ ] Anchor text is descriptive — it should tell a reader what the linked page contains before they click, not generic text like "click here."
- [ ] External links to sources we don't fully vouch for (or to untrusted content) carry a `nofollow` or equivalent annotation.
- [ ] Any user-generated content area (comments, forum posts) auto-applies `nofollow` (or equivalent) to links submitted by users — this is a CMS-level control, not a manual per-post decision.

## 6. Promotion (Supporting, Not Core SEO)

- [ ] New content has at least one promotion channel attached at publish time (social, newsletter, community share, etc.) to accelerate discovery — this supports crawling via natural link discovery but is not a ranking mechanism in itself.
- [ ] Promotion volume stays reasonable — repeated, aggressive self-promotion reads as spam to both users and search engines and should be avoided.

## 7. Explicitly Out of Scope / Do Not Do

These are common practices to actively avoid, since they either have no effect or actively violate search engine policy:

- Don't rely on the meta keywords tag — it has no effect on ranking.
- Don't keyword-stuff (unnaturally repeating words/variants) — this is treated as a spam violation, not just bad style.
- Don't chase specific keyword placement in the domain name or URL path as a ranking tactic — it has negligible effect beyond how it reads in a breadcrumb.
- Don't treat a minimum or maximum word count as a requirement.
- Don't treat heading order/count as a ranking factor — semantic heading order matters for accessibility, not for search ranking.
- Don't treat duplicate content as something requiring a "penalty" fix — it's an efficiency issue to clean up when convenient, not an emergency (copying someone else's content is a separate, more serious issue).
- Don't cite "E-E-A-T" as a direct ranking factor when justifying work — it isn't one; write for genuine expertise and reliability instead of optimizing for the acronym.

## 8. Pre-Publish Checklist (Quick Reference)

1. Not blocked from crawling/indexing (unless intentional)
2. Reachable via an internal link
3. Descriptive URL, correct directory
4. Canonical version set if duplicates exist
5. Unique title tag + meta description written
6. Images have alt text and sit near relevant copy
7. Internal/external links use descriptive anchor text; untrusted external links are `nofollow`
8. Proofread and free of factual/grammar errors
9. Promotion channel identified

---

*This standard should be revisited periodically — SEO best practices evolve, and some past "best practices" (see Section 7) are actively outdated.*
