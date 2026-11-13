---
title: "What a Web App Is"
description: "a web app is a program downloaded from the internet and run by your browser."
---

# What a Web App Is

> **In one line:** a web app is a program downloaded from the internet and run by your browser.
> **Audience:** everyone. **Reading time:** ~8 min.

## The problem being solved

VIT's official VTOP portal is a website. AmazeCC is also "a website" — but it behaves like a
downloadable program (think Excel or WhatsApp) that happens to be installed through the browser.
To build either one you need to know what actually happens when someone opens it.

## The five-step story of every page load

1. **You type a URL** (e.g. `https://amazecc.com/`). A URL is an address:
   `https` (how to talk), `amazecc.com` (which machine), `/` (which page).
2. **The browser asks a Domain Name System (DNS)** — the internet's phone book —
   "where is amazecc.com?", gets an IP address back.
3. **The browser connects (TLS/HTTPS)** and asks that machine for `/`: "GET /".
4. **The server responds with HTML** — a text document describing the page's structure —
   plus files (CSS for styling, JS for behavior).
5. **The browser paints pixels** from the HTML+CSS, then **runs the JavaScript** it downloaded.
   For AmazeCC, that JavaScript is the actual app.

That is the whole trick. AmazeCC adds no server-side magic: after step 5, the browser is on a
bicycle. It only occasionally telephones the backend (step 3 from anywhere, at any time) with:

```
You:   POST https://api.amazecc.com/api/attendance   {semesterId: "CH20262705", cookies…}
API:   {success: true, attRes: {…}}
```

## Client vs server — the two halves of any web app

|                                  | Client (your browser)                                                    | Server (the backend)                         |
| -------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| Who owns it                      | the student                                                              | AmazeCC team                                 |
| Can keep secrets?                | **No** — anything you ship runs on the student's machine and can be read | Yes — `.env` only exists there               |
| Can run forever?                 | No — tab closes                                                          | Yes — as long as the host allows             |
| Can touch VTOP?                  | Never directly (CORS + politeness)                                       | Yes, it scrapes VTOP on the student's behalf |
| Can be trusted with credentials? | Held briefly in memory, encrypted on disk                                | Technically, but we don't need to            |

**Consequence for you:** anything secret in this repo's code is not secret. Only
`NEXT_PUBLIC_*` variables are shipped, and they are all public-by-design values.

## "Static" vs "dynamic" sites

- A **dynamic site** (WordPress, VTOP, most backends) builds the page _on the server, per request_.
- A **static site** (AmazeCC) has its pages _pre-built at deploy time_ and just sits there as files.
- A **single-page app (SPA)** is one HTML file whose JavaScript swaps what you see — like a GUI program.
  AmazeCC is a static export **and** a mostly-SPA: `/` is a real HTML file, and everything else
  inside it is components swapped by state.

## What you should remember

1. Browsers run the app; servers only answer questions.
2. AmazeCC trusts nothing to "the web server" — there isn't one for the frontend.
3. The backend is a _separate_ repo and a _separate_ contract; this repo never opens a socket to
   Supabase, VTOP, or Moodle — it calls the API, and the API does the scraping.

## Quiz

1. Why is it wrong to put `NEXT_PUBLIC_VTOP_PASSWORD` in `.env.example`?
2. What does the browser do between URL and pixels? List the five steps.
3. Name one AmazeCC feature that could **not** work if the API went down, and one that could
   still work (hint: offline).
