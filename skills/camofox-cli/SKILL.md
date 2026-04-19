---
name: camofox-cli
description: >-
  Use this skill when you need to browse or automate the web through a running
  camofox-browser server with the local camofox-cli tool. It is for terminal-first
  browser workflows against an existing container or remote server: opening
  tabs, navigating, snapshots with element refs, clicking, typing, scrolling,
  screenshots, downloads, images, cookies, storage state, YouTube transcripts,
  and OpenClaw-compatible actions.
---

# Camofox CLI

Use `camofox-cli` to control an already-running `camofox-browser` server. Do not start Docker or create a new browser server unless the user explicitly asks. Prefer the CLI over raw `curl` because it tracks the last tab ID in `~/.camofox/cli-state.json`.

## Setup

Use the server URL supplied by the user or environment:

```bash
export CAMOFOX_BASE_URL="${CAMOFOX_BASE_URL:-http://localhost:9377}"
export CAMOFOX_USER="${CAMOFOX_USER:-agent1}"
```

Per-command override:

```bash
camofox-cli --base-url http://localhost:9377 --user agent1 health
```

If a protected endpoint returns `403`, provide `--api-key "$CAMOFOX_API_KEY"` or export `CAMOFOX_API_KEY`. For `stop`, use `--admin-key "$CAMOFOX_ADMIN_KEY"`.

## Core Loop

1. Create or reuse a tab:

```bash
camofox-cli open https://example.com
```

2. Inspect page content and refs:

```bash
camofox-cli snapshot
```

3. Interact using refs from the latest snapshot:

```bash
camofox-cli click e1
camofox-cli type e2 "search text" --enter
camofox-cli scroll down 800
```

4. Snapshot again after navigation or UI changes:

```bash
camofox-cli snapshot
```

Refs reset after navigation. Always get a fresh snapshot before using old refs if the page changed.

## Commands

Health and server status:

```bash
camofox-cli health
camofox-cli status
camofox-cli metrics
camofox-cli start
camofox-cli stop --admin-key "$CAMOFOX_ADMIN_KEY"
```

Tabs and sessions:

```bash
camofox-cli open [url]
camofox-cli tabs
camofox-cli state
camofox-cli close [tabId]
camofox-cli close-group [sessionKey]
camofox-cli close-session [userId]
```

Navigation:

```bash
camofox-cli navigate https://example.com
camofox-cli search google "query"
camofox-cli search youtube "query" --new
camofox-cli back
camofox-cli forward
camofox-cli refresh
camofox-cli wait-ready --timeout 10000
```

Search engines: `google`, `youtube`, `amazon`, `reddit`, `subreddit`, `wikipedia`, `twitter`, `x`, `yelp`, `spotify`, `netflix`, `linkedin`, `instagram`, `tiktok`, `twitch`.

Inspection:

```bash
camofox-cli snapshot
camofox-cli snapshot --offset 12000
camofox-cli links --limit 50
camofox-cli images --limit 8
camofox-cli images --include-data --max-bytes 1000000
camofox-cli downloads
camofox-cli downloads --include-data --consume
camofox-cli stats
camofox-cli url
camofox-cli title
camofox-cli eval "document.title"
```

Input:

```bash
camofox-cli click e4
camofox-cli click --selector "button[type=submit]"
camofox-cli type e5 "hello"
camofox-cli type e5 "hello" --mode keyboard --delay 40
camofox-cli type e5 "hello" --enter
camofox-cli press Escape
camofox-cli scroll down 600
camofox-cli hover e8
camofox-cli scroll-into-view e12
camofox-cli wait 1500
camofox-cli wait --text "Dashboard"
camofox-cli wait --load-state networkidle
```

Files and plugins:

```bash
camofox-cli screenshot -o page.png
camofox-cli screenshot -o full.png --full-page
camofox-cli import-cookies cookies.json
camofox-cli storage-state [userId]
camofox-cli youtube-transcript "https://www.youtube.com/watch?v=VIDEO_ID" --lang en
```

Use `--format json` for structured parsing and `--format plain` when only the main text value is useful:

```bash
camofox-cli snapshot --format plain
camofox-cli links --format json
```

## OpenClaw-Compatible Actions

The CLI also exposes `/act` for actions not covered by first-class endpoints:

```bash
camofox-cli act click e1
camofox-cli act type e2 "hello" --submit
camofox-cli act press Enter
camofox-cli act scroll down 800
camofox-cli act hover e4
camofox-cli act wait --text "Ready"
camofox-cli act scrollIntoView e9
```

Prefer first-class commands when available; use `act` for `hover`, `scrollIntoView`, and text/load-state waits.

## Troubleshooting

- `tabId required`: run `camofox-cli open <url>` or pass `--tab <tabId>`.
- `Tab not found`: the tab may belong to another `--user`, have expired, or been recycled. Run `camofox-cli tabs --user <id>`.
- Stale `eN` refs: run `camofox-cli snapshot` again and retry with new refs.
- Snapshot truncated: rerun with `--offset <nextOffset>` from the previous response, or use `--format json`.
- Cookie or storage export `403`: remote containers usually require `CAMOFOX_API_KEY`; loopback-only unauthenticated access does not apply from another host.
