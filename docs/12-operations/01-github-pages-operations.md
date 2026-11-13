---
title: "Operating GitHub Pages"
description: "git push to main = production. No staging, no containers, no blue/green — the revert button is git revert."
---

# 01 — Operating GitHub Pages

> **In one line:** git push to main = production. No staging, no containers, no blue/green — the revert button is `git revert`.

- Site: https://amazecc.com (CNAME → Pages artifact)
- Deploy: `.github/workflows/nextjs.yml` — push main → build → `out/` → deploy-pages
- Cache: Service Worker + CDN = students hold the shell for ~days; emergency fixes must be
  SW-version bumps, not just code changes
- Domain: academics CNAME record lives outside this repo (DNS managed by the org)
- Uptime: GitHub Pages SLA + Cloudflare; failures independent of our infra choices
