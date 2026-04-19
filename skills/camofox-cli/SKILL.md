---
name: camofox-cli
description: Use this skill when you need to browse or automate the web through a running camofox-browser server with the local camofox CLI. It is for terminal-first browser workflows against an existing container or remote server: opening tabs, navigating, snapshots with element refs, clicking, typing, scrolling, screenshots, downloads, images, cookies, storage state, YouTube transcripts, and OpenClaw-compatible actions.
---

# Camofox CLI

Use `camofox` to control an already-running `camofox-browser` server. Do not start Docker or create a new browser server unless the user explicitly asks. Prefer the CLI over raw `curl` because it tracks the last tab ID in `~/.camofox/cli-state.json`.

## Setup

Use the server URL supplied by the user or environment:

```bash
export CAMOFOX_BASE_URL="${CAMOFOX_BASE_URL:-http://localhost:9377}"
export CAMOFOX_USER="${CAMOFOX_USER:-agent1}"
```

Per-command override:

```bash
camofox --base-url http://localhost:9377 --user agent1 health
```

If a protected endpoint returns `403`, provide `--api-key "$CAMOFOX_API_KEY"` or export `CAMOFOX_API_KEY`. For `stop`, use `--admin-key "$CAMOFOX_ADMIN_KEY"`.

## Core Loop

1. Create or reuse a tab:

```bash
camofox open https://example.com
```

2. Inspect page content and refs:

```bash
camofox snapshot
```

3. Interact using refs from the latest snapshot:

```bash
camofox click e1
camofox type e2 "search text" --enter
camofox scroll down 800
```

4. Snapshot again after navigation or UI changes:

```bash
camofox snapshot
```

Refs reset after navigation. Always get a fresh snapshot before using old refs if the page changed.

## Commands

Health and server status:

```bash
camofox health
camofox status
camofox metrics
camofox start
camofox stop --admin-key "$CAMOFOX_ADMIN_KEY"
```

Tabs and sessions:

```bash
camofox open [url]
camofox tabs
camofox state
camofox close [tabId]
camofox close-group [sessionKey]
camofox close-session [userId]
```

Navigation:

```bash
camofox navigate https://example.com
camofox search google "query"
camofox search youtube "query" --new
camofox back
camofox forward
camofox refresh
camofox wait-ready --timeout 10000
```

Search engines: `google`, `youtube`, `amazon`, `reddit`, `subreddit`, `wikipedia`, `twitter`, `x`, `yelp`, `spotify`, `netflix`, `linkedin`, `instagram`, `tiktok`, `twitch`.

Inspection:

```bash
camofox snapshot
camofox snapshot --offset 12000
camofox links --limit 50
camofox images --limit 8
camofox images --include-data --max-bytes 1000000
camofox downloads
camofox downloads --include-data --consume
camofox stats
camofox url
camofox title
camofox eval "document.title"
```

Input:

```bash
camofox click e4
camofox click --selector "button[type=submit]"
camofox type e5 "hello"
camofox type e5 "hello" --mode keyboard --delay 40
camofox type e5 "hello" --enter
camofox press Escape
camofox scroll down 600
camofox hover e8
camofox scroll-into-view e12
camofox wait 1500
camofox wait --text "Dashboard"
camofox wait --load-state networkidle
```

Files and plugins:

```bash
camofox screenshot -o page.png
camofox screenshot -o full.png --full-page
camofox import-cookies cookies.json
camofox storage-state [userId]
camofox youtube-transcript "https://www.youtube.com/watch?v=VIDEO_ID" --lang en
```

Use `--format json` for structured parsing and `--format plain` when only the main text value is useful:

```bash
camofox snapshot --format plain
camofox links --format json
```

## OpenClaw-Compatible Actions

The CLI also exposes `/act` for actions not covered by first-class endpoints:

```bash
camofox act click e1
camofox act type e2 "hello" --submit
camofox act press Enter
camofox act scroll down 800
camofox act hover e4
camofox act wait --text "Ready"
camofox act scrollIntoView e9
```

Prefer first-class commands when available; use `act` for `hover`, `scrollIntoView`, and text/load-state waits.

## Troubleshooting

- `tabId required`: run `camofox open <url>` or pass `--tab <tabId>`.
- `Tab not found`: the tab may belong to another `--user`, have expired, or been recycled. Run `camofox tabs --user <id>`.
- Stale `eN` refs: run `camofox snapshot` again and retry with new refs.
- Snapshot truncated: rerun with `--offset <nextOffset>` from the previous response, or use `--format json`.
- Cookie or storage export `403`: remote containers usually require `CAMOFOX_API_KEY`; loopback-only unauthenticated access does not apply from another host.
