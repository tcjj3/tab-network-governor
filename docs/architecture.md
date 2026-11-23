# Architecture

## Problem model

A long-lived web app can behave as an independent client per tab. With many tabs, background polling/sync/retry activity scales with tab count even when only one task is actively being used.

## Full Extension

```text
MAIN world: soft-freeze.js
  ├─ wraps fetch
  ├─ wraps XHR send
  ├─ drops beacon while governed
  ├─ deduplicates queued GET/HEAD
  └─ waits for NETWORK_STATE ready
             ▲
             │ same-origin window.postMessage bridge
ISOLATED world: visibility.js
  ├─ watches Page Visibility
  ├─ reports state to background
  └─ forwards DNR ACK to MAIN
             ▲
             │ chrome.runtime messaging
Service worker: background.js
  ├─ manages configured site patterns
  ├─ dynamically registers content scripts
  ├─ tracks hidden managed tab IDs
  ├─ updates session DNR rule
  ├─ returns ACK only after DNR update completes
  └─ fail-opens active/ambiguous tabs
```

Without an ACK, queued requests can resume a few milliseconds before the DNR rule is removed and get incorrectly blocked. Full Edition makes the browser-network state commit part of the resume protocol.

## Lite Extension

Lite removes MAIN-world monkey-patching. It only tracks visibility and updates DNR. This is simpler, but blocked requests can look like network failures and trigger app retries.

## Portable Userscript

Portable operates only at the page layer. It cannot promise Worker/WebSocket/browser-network coverage, but it can work in environments where a normal extension cannot be installed.
