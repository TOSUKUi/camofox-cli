#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';

const ENV = process['env'];
const DEFAULT_BASE_URL = ENV.CAMOFOX_BASE_URL || ENV.CAMOFOX_URL || 'http://localhost:9377';
const DEFAULT_USER = ENV.CAMOFOX_USER || 'cli-default';
const DEFAULT_SESSION = ENV.CAMOFOX_SESSION || 'default';
const STATE_FILE = path.join(os.homedir(), '.camofox', 'cli-state.json');

const MACROS = {
  google: '@google_search',
  youtube: '@youtube_search',
  amazon: '@amazon_search',
  reddit: '@reddit_search',
  subreddit: '@reddit_subreddit',
  wikipedia: '@wikipedia_search',
  twitter: '@twitter_search',
  x: '@twitter_search',
  yelp: '@yelp_search',
  spotify: '@spotify_search',
  netflix: '@netflix_search',
  linkedin: '@linkedin_search',
  instagram: '@instagram_search',
  tiktok: '@tiktok_search',
  twitch: '@twitch_search',
};

function parseGlobal(argv) {
  const global = {
    baseUrl: DEFAULT_BASE_URL,
    userId: DEFAULT_USER,
    sessionKey: DEFAULT_SESSION,
    format: ENV.CAMOFOX_FORMAT || 'text',
    apiKey: ENV.CAMOFOX_API_KEY || '',
    adminKey: ENV.CAMOFOX_ADMIN_KEY || '',
    timeoutMs: Number(ENV.CAMOFOX_CLI_TIMEOUT_MS || 120000),
    tabId: '',
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base-url' || a === '--url') global.baseUrl = argv[++i];
    else if (a.startsWith('--base-url=')) global.baseUrl = a.slice(11);
    else if (a === '--user' || a === '--user-id') global.userId = argv[++i];
    else if (a.startsWith('--user=')) global.userId = a.slice(7);
    else if (a === '--session' || a === '--session-key') global.sessionKey = argv[++i];
    else if (a.startsWith('--session=')) global.sessionKey = a.slice(10);
    else if (a === '--tab' || a === '--tab-id' || a === '--target' || a === '--target-id') global.tabId = argv[++i];
    else if (a.startsWith('--tab=')) global.tabId = a.slice(6);
    else if (a === '--format' || a === '-f') global.format = argv[++i];
    else if (a.startsWith('--format=')) global.format = a.slice(9);
    else if (a === '--api-key') global.apiKey = argv[++i];
    else if (a.startsWith('--api-key=')) global.apiKey = a.slice(10);
    else if (a === '--admin-key') global.adminKey = argv[++i];
    else if (a.startsWith('--admin-key=')) global.adminKey = a.slice(12);
    else if (a === '--timeout') global.timeoutMs = Number(argv[++i]);
    else if (a === '-h' || a === '--help') rest.push('help');
    else if (a === '-V' || a === '--version') rest.push('version');
    else rest.push(a);
  }
  global.baseUrl = String(global.baseUrl).replace(/\/+$/, '');
  if (!['text', 'json', 'plain'].includes(global.format)) throw new Error('format must be text, json, or plain');
  return { global, args: rest };
}

function parseOptions(args) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('-') || a === '-') {
      pos.push(a);
      continue;
    }
    const raw = a.replace(/^-+/, '');
    const eq = raw.indexOf('=');
    const key = raw.slice(0, eq < 0 ? undefined : eq).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (eq >= 0) opt[key] = raw.slice(eq + 1);
    else if (i + 1 < args.length && !args[i + 1].startsWith('-')) opt[key] = args[++i];
    else opt[key] = true;
  }
  return { pos, opt };
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(patch) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...patch, updatedAt: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600 });
}

function bool(v) {
  return v === true || v === 'true' || v === '1' || v === 'yes';
}

function number(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function tabId(opt, g) {
  const id = opt.tab || opt.tabId || opt.target || opt.targetId || g?.tabId || readState().lastTabId;
  if (!id) throw new Error('tabId required. Pass --tab <id> or run open first.');
  return id;
}

async function http(g, method, route, { body, query, binary = false, admin = false } = {}) {
  const url = new URL(route, g.baseUrl + '/');
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== false) url.searchParams.set(k, String(v));
  }
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (g.apiKey) headers.Authorization = `Bearer ${g.apiKey}`;
  if (admin && g.adminKey) headers['x-admin-key'] = g.adminKey;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), g.timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ac.signal,
    });
    if (binary) {
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!res.ok) throw new Error(`${res.status} ${buffer.toString('utf8')}`);
      return buffer;
    }
    const text = await res.text();
    const data = text ? parseJson(text) : {};
    if (!res.ok) {
      const msg = data?.error || text || res.statusText;
      const err = new Error(`${res.status} ${msg}`);
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function out(value, g, key) {
  if (g.format === 'json') return process.stdout.write(JSON.stringify(value, null, 2) + '\n');
  if (g.format === 'plain') {
    if (typeof value === 'string') return process.stdout.write(value + '\n');
    if (key && value?.[key] !== undefined) return process.stdout.write(String(value[key]) + '\n');
    return process.stdout.write(JSON.stringify(value) + '\n');
  }
  if (key === 'snapshot' && value?.snapshot) {
    process.stdout.write(value.snapshot + '\n');
    if (value.hasMore) process.stderr.write(`\nMore snapshot available: --offset ${value.nextOffset}\n`);
    return;
  }
  if (key === 'transcript' && value?.transcript) return process.stdout.write(value.transcript + '\n');
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function macro(name) {
  if (!name) return '@google_search';
  if (name.startsWith('@')) return name;
  const found = MACROS[name.toLowerCase()];
  if (!found) throw new Error(`unknown search engine: ${name}`);
  return found;
}

async function main() {
  const { global: g, args } = parseGlobal(process.argv.slice(2));
  const [cmd = 'help', ...rest] = args;
  const { pos, opt } = parseOptions(rest);

  if (cmd === 'help') return out(help(), { ...g, format: 'plain' });
  if (cmd === 'version') return out(JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).version, { ...g, format: 'plain' });
  if (cmd === 'state') return out(readState(), g);
  if (cmd === 'health') return out(await http(g, 'GET', 'health'), g);
  if (cmd === 'status' || cmd === 'info') return out(await http(g, 'GET', ''), g);
  if (cmd === 'metrics') return out(await http(g, 'GET', 'metrics'), { ...g, format: 'plain' });
  if (cmd === 'start') return out(await http(g, 'POST', 'start'), g);
  if (cmd === 'stop') return out(await http(g, 'POST', 'stop', { admin: true }), g);
  if (cmd === 'tabs' || cmd === 'list') return out(await http(g, 'GET', 'tabs', { query: { userId: g.userId } }), g);

  if (cmd === 'open' || cmd === 'create') {
    const body = { userId: g.userId, sessionKey: opt.session || g.sessionKey };
    if (pos[0] || opt.url) body.url = pos[0] || opt.url;
    const r = await http(g, 'POST', 'tabs', { body });
    writeState({ lastTabId: r.tabId, userId: g.userId, sessionKey: body.sessionKey, baseUrl: g.baseUrl });
    return out(r, g);
  }

  if (cmd === 'navigate' || cmd === 'nav') {
    const id = tabId(opt, g);
    const body = { userId: g.userId, sessionKey: opt.session || g.sessionKey };
    if (opt.macro) {
      body.macro = macro(opt.macro);
      body.query = pos.join(' ') || opt.query || '';
    } else {
      body.url = pos[0] || opt.url;
    }
    return out(await http(g, 'POST', `tabs/${id}/navigate`, { body }), g);
  }

  if (cmd === 'search') {
    let engine = opt.engine || 'google';
    if (!opt.engine && pos[0] && (MACROS[pos[0].toLowerCase()] || pos[0].startsWith('@'))) engine = pos.shift();
    const query = pos.join(' ') || opt.query || '';
    let id = opt.tab || opt.tabId || readState().lastTabId;
    if (!id || bool(opt.new)) {
      const r = await http(g, 'POST', 'tabs', { body: { userId: g.userId, sessionKey: opt.session || g.sessionKey } });
      id = r.tabId;
      writeState({ lastTabId: id, userId: g.userId, baseUrl: g.baseUrl });
    }
    return out(await http(g, 'POST', `tabs/${id}/navigate`, { body: { userId: g.userId, sessionKey: opt.session || g.sessionKey, macro: macro(engine), query } }), g);
  }

  if (cmd === 'snapshot' || cmd === 'snap') {
    const r = await http(g, 'GET', `tabs/${tabId(opt, g)}/snapshot`, { query: { userId: g.userId, offset: opt.offset, includeScreenshot: bool(opt.includeScreenshot) } });
    return out(r, g, 'snapshot');
  }

  if (cmd === 'click') {
    const body = { userId: g.userId };
    if (opt.selector) body.selector = opt.selector;
    else body.ref = opt.ref || pos[0];
    return out(await http(g, 'POST', `tabs/${tabId(opt, g)}/click`, { body }), g);
  }

  if (cmd === 'type') {
    const body = { userId: g.userId, mode: opt.mode || 'fill', text: opt.text ?? pos.slice(opt.selector ? 0 : 1).join(' ') };
    if (opt.selector) body.selector = opt.selector;
    else body.ref = opt.ref || pos[0];
    if (opt.delay) body.delay = number(opt.delay, 30);
    if (bool(opt.enter) || bool(opt.submit) || bool(opt.pressEnter)) body.pressEnter = true;
    return out(await http(g, 'POST', `tabs/${tabId(opt, g)}/type`, { body }), g);
  }

  if (cmd === 'press') return out(await http(g, 'POST', `tabs/${tabId(opt, g)}/press`, { body: { userId: g.userId, key: pos[0] || opt.key } }), g);
  if (cmd === 'scroll') return out(await http(g, 'POST', `tabs/${tabId(opt, g)}/scroll`, { body: { userId: g.userId, direction: opt.direction || pos[0] || 'down', amount: number(opt.amount || pos[1], 500) } }), g);
  if (['back', 'forward', 'refresh'].includes(cmd)) return out(await http(g, 'POST', `tabs/${tabId(opt, g)}/${cmd}`, { body: { userId: g.userId } }), g);
  if (cmd === 'reload') return out(await http(g, 'POST', `tabs/${tabId(opt, g)}/refresh`, { body: { userId: g.userId } }), g);
  if (cmd === 'wait-ready') return out(await http(g, 'POST', `tabs/${tabId(opt, g)}/wait`, { body: { userId: g.userId, timeout: number(opt.timeout, 10000), waitForNetwork: !bool(opt.noNetwork) } }), g);
  if (cmd === 'links') return out(await http(g, 'GET', `tabs/${tabId(opt, g)}/links`, { query: { userId: g.userId, limit: opt.limit, offset: opt.offset } }), g);
  if (cmd === 'downloads') return out(await http(g, 'GET', `tabs/${tabId(opt, g)}/downloads`, { query: { userId: g.userId, includeData: bool(opt.includeData), consume: bool(opt.consume), maxBytes: opt.maxBytes } }), g);
  if (cmd === 'images') return out(await http(g, 'GET', `tabs/${tabId(opt, g)}/images`, { query: { userId: g.userId, includeData: bool(opt.includeData), limit: opt.limit, maxBytes: opt.maxBytes } }), g);

  if (cmd === 'screenshot') {
    const buffer = await http(g, 'GET', `tabs/${tabId(opt, g)}/screenshot`, { query: { userId: g.userId, fullPage: bool(opt.fullPage) }, binary: true });
    const file = opt.output || opt.o || pos[0];
    if (!file) return process.stdout.write(buffer);
    fs.writeFileSync(file, buffer);
    return out({ ok: true, output: file, bytes: buffer.length }, g);
  }

  if (cmd === 'stats') return out(await http(g, 'GET', `tabs/${tabId(opt, g)}/stats`, { query: { userId: g.userId } }), g);
  if (cmd === 'eval' || cmd === 'evaluate') return out(await http(g, 'POST', `tabs/${tabId(opt, g)}/evaluate`, { body: { userId: g.userId, expression: opt.expression || pos.join(' ') } }), g);
  if (cmd === 'url') return out(await http(g, 'POST', `tabs/${tabId(opt, g)}/evaluate`, { body: { userId: g.userId, expression: 'location.href' } }), g);
  if (cmd === 'title') return out(await http(g, 'POST', `tabs/${tabId(opt, g)}/evaluate`, { body: { userId: g.userId, expression: 'document.title' } }), g);

  if (cmd === 'close') {
    const id = pos[0] || tabId(opt, g);
    const r = await http(g, 'DELETE', `tabs/${id}`, { query: { userId: g.userId } });
    if (readState().lastTabId === id) writeState({ lastTabId: null });
    return out(r, g);
  }
  if (cmd === 'close-group') return out(await http(g, 'DELETE', `tabs/group/${encodeURIComponent(pos[0] || opt.session || g.sessionKey)}`, { query: { userId: g.userId } }), g);
  if (cmd === 'close-session') return out(await http(g, 'DELETE', `sessions/${encodeURIComponent(pos[0] || g.userId)}`), g);
  if (cmd === 'import-cookies' || (cmd === 'cookies' && pos[0] === 'import')) {
    const file = cmd === 'cookies' ? pos[1] : pos[0];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return out(await http(g, 'POST', `sessions/${encodeURIComponent(g.userId)}/cookies`, { body: Array.isArray(data) ? { cookies: data } : data }), g);
  }
  if (cmd === 'storage-state') return out(await http(g, 'GET', `sessions/${encodeURIComponent(pos[0] || g.userId)}/storage_state`), g);
  if (cmd === 'youtube-transcript' || (cmd === 'youtube' && pos[0] === 'transcript')) {
    const url = cmd === 'youtube' ? pos[1] : pos[0];
    const r = await http(g, 'POST', 'youtube/transcript', { body: { url, languages: String(opt.lang || opt.language || 'en').split(',') } });
    return out(r, g, 'transcript');
  }
  if (cmd === 'act' || ['hover', 'wait', 'scroll-into-view'].includes(cmd)) return action(g, cmd, pos, opt);

  throw new Error(`unknown command: ${cmd}`);
}

async function action(g, cmd, pos, opt) {
  const kind = cmd === 'act' ? pos.shift() : cmd === 'scroll-into-view' ? 'scrollIntoView' : cmd;
  const body = { userId: g.userId, targetId: tabId(opt, g), kind };
  if (kind === 'click' || kind === 'hover') {
    if (opt.selector) body.selector = opt.selector;
    else body.ref = opt.ref || pos[0];
    if (bool(opt.doubleClick)) body.doubleClick = true;
  } else if (kind === 'type') {
    if (opt.selector) body.selector = opt.selector;
    else body.ref = opt.ref || pos[0];
    body.text = opt.text ?? pos.slice(opt.selector ? 0 : 1).join(' ');
    body.mode = opt.mode || 'fill';
    if (bool(opt.submit) || bool(opt.enter)) body.submit = true;
  } else if (kind === 'press') {
    body.key = opt.key || pos[0];
  } else if (kind === 'scroll' || kind === 'scrollIntoView') {
    if (opt.ref || pos[0]?.startsWith('e')) body.ref = opt.ref || pos[0];
    body.direction = opt.direction || pos[0] || 'down';
    body.amount = number(opt.amount || pos[1], 500);
  } else if (kind === 'wait') {
    if (opt.text) body.text = opt.text;
    if (opt.loadState) body.loadState = opt.loadState;
    if (opt.timeMs || pos[0]) body.timeMs = number(opt.timeMs || pos[0], 1000);
  }
  return out(await http(g, 'POST', 'act', { body }), g);
}

function help() {
  return `camofox CLI

Connects to an existing camofox-browser server. Default: ${DEFAULT_BASE_URL}

Global:
  --base-url <url> --user <id> --session <key> --tab <id>
  --format text|json|plain --api-key <key> --admin-key <key>

Commands:
  health | status | metrics | start | stop
  open [url] | tabs | state | close [tabId] | close-group [key] | close-session [userId]
  navigate <url> | search [engine] <query> [--new] | snapshot [--offset n]
  click <ref> | click --selector css
  type <ref> <text> [--mode fill|keyboard] [--enter]
  press <key> | scroll [down|up|left|right] [amount] | back | forward | refresh | wait-ready
  links | downloads [--include-data] [--consume] | images [--include-data] | screenshot -o file.png
  stats | eval <expression> | url | title
  import-cookies cookies.json | storage-state [userId] | youtube-transcript <url> [--lang en,ja]
  act <kind> ... | hover <ref> | wait [ms] | scroll-into-view <ref>

Search engines:
  ${Object.keys(MACROS).join(', ')}
`;
}

main().catch(err => {
  process.stderr.write(err.message + '\n');
  if (err.data && typeof err.data === 'object') process.stderr.write(JSON.stringify(err.data, null, 2) + '\n');
  process.exitCode = 1;
});
