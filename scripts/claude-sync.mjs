#!/usr/bin/env node
// Syncs this project's Claude Code conversations and memory between computers through a PRIVATE git repo.
//
//   node scripts/claude-sync.mjs setup            first run on a new computer: clone the sync repo and pull
//   node scripts/claude-sync.mjs pull             copy newer conversations/memory from the sync repo into ~/.claude
//   node scripts/claude-sync.mjs push [--debounce] copy local conversations/memory to the sync repo and push
//   node scripts/claude-sync.mjs status           show what would be synced
//
// Add --hook when run from Claude Code hooks (JSON output, never fails the session).
// What is synced: ~/.claude/projects/<slug-of-this-folder>/*.jsonl (conversation transcripts) and memory/**.
// Conversations only grow, so the larger copy wins. Memory files: a file you haven't changed since the last
// sync accepts the other computer's version; if both changed, this computer's copy wins on push. Nothing is deleted.
// Env overrides (used for testing): CLAUDE_SYNC_REPO, CLAUDE_CONFIG_DIR, CLAUDE_SYNC_DIR.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const cmd = argv.find((a) => !a.startsWith('--')) ?? 'status';
const HOOK = argv.includes('--hook');
const DEBOUNCE_MS = 10 * 60 * 1000;

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = readJson(path.join(projectDir, 'scripts', 'claude-sync.config.json'), {});
const repoUrl = process.env.CLAUDE_SYNC_REPO || config.repo;
const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const syncRoot = process.env.CLAUDE_SYNC_DIR || path.join(os.homedir(), '.claude-sync');
const repoName = String(repoUrl || 'claude-sync').replace(/[\\/]+$/, '').replace(/\.git$/, '').split(/[\\/:]/).pop();
const cloneDir = path.join(syncRoot, repoName);
const statePath = path.join(syncRoot, `${repoName}.state.json`);

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Claude Code stores a project's history in a folder named after its absolute path, non-alphanumerics → '-'. */
function localProjectDir() {
  const slug = projectDir.replace(/[^a-zA-Z0-9]/g, '-');
  const projects = path.join(claudeDir, 'projects');
  try {
    const hit = fs.readdirSync(projects).find((d) => d.toLowerCase() === slug.toLowerCase());
    if (hit) return path.join(projects, hit);
  } catch {
    /* no projects folder yet */
  }
  return path.join(projects, slug);
}

// ── File helpers ─────────────────────────────────────────────
const posix = (p) => p.split(path.sep).join('/');
const isSession = (rel) => rel.endsWith('.jsonl') && !rel.includes('/');
const toRepo = (rel) => (isSession(rel) ? `sessions/${rel}` : rel);
const toLocal = (repoRel) => (repoRel.startsWith('sessions/') ? repoRel.slice('sessions/'.length) : repoRel);

function hashOf(file) {
  try {
    return createHash('sha1').update(fs.readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
}
const sizeOf = (file) => {
  try {
    return fs.statSync(file).size;
  } catch {
    return -1;
  }
};

function walk(base, rel, out) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(base, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) walk(base, r, out);
    else if (e.isFile()) out.push(posix(r));
  }
}

/** Local files to sync, relative to the project history folder: top-level *.jsonl + memory/**. */
function listLocal(local) {
  const out = [];
  try {
    for (const e of fs.readdirSync(local, { withFileTypes: true })) if (e.isFile() && e.name.endsWith('.jsonl')) out.push(e.name);
  } catch {
    /* nothing yet */
  }
  walk(local, 'memory', out);
  return out;
}

/** Files in the sync repo, as repo-relative paths. */
function listRepo() {
  const out = [];
  walk(cloneDir, 'sessions', out);
  walk(cloneDir, 'memory', out);
  return out.filter((p) => !p.startsWith('sessions/') || p.endsWith('.jsonl'));
}

function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// ── Git ──────────────────────────────────────────────────────
function git(args, cwd = cloneDir) {
  const env = { ...process.env };
  if (HOOK) env.GIT_TERMINAL_PROMPT = '0'; // never hang a Claude session on a terminal password prompt
  return execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 45_000 }).trim();
}

function ensureClone() {
  if (!repoUrl) throw new Error('no sync repo configured — set "repo" in scripts/claude-sync.config.json');
  if (fs.existsSync(path.join(cloneDir, '.git'))) return;
  fs.mkdirSync(syncRoot, { recursive: true });
  git(['clone', '--quiet', repoUrl, cloneDir], syncRoot);
}

/** The clone is only a mirror of files we can always recompute, so just move it to the remote's latest state. */
function fetchLatest() {
  git(['fetch', '--quiet', 'origin']);
  let remote = false;
  try {
    git(['rev-parse', '--verify', '--quiet', 'origin/main']);
    remote = true;
  } catch {
    /* empty repo: nothing pushed yet */
  }
  if (remote) git(['reset', '--quiet', '--hard', 'origin/main']);
}

function commitAndPush() {
  const attrs = path.join(cloneDir, '.gitattributes');
  if (!fs.existsSync(attrs)) fs.writeFileSync(attrs, '* -text\n'); // byte-identical files on every OS
  git(['add', '-A']);
  if (!git(['status', '--porcelain'])) return false;
  git(['-c', 'user.name=claude-sync', '-c', 'user.email=claude-sync@users.noreply.github.com',
    'commit', '--quiet', '-m', `sync from ${os.hostname()} at ${new Date().toISOString()}`]);
  git(['push', '--quiet', 'origin', 'HEAD:main']);
  return true;
}

// ── Merge ────────────────────────────────────────────────────
function mergeIn(local, state) {
  let changed = 0;
  for (const repoRel of listRepo()) {
    const rel = toLocal(repoRel);
    const src = path.join(cloneDir, repoRel);
    const dst = path.join(local, rel);
    const srcHash = hashOf(src);
    const dstHash = hashOf(dst);
    if (srcHash === dstHash) {
      state.synced[rel] = srcHash;
      continue;
    }
    const take = isSession(rel) ? !dstHash || sizeOf(src) > sizeOf(dst) : !dstHash || dstHash === state.synced[rel];
    if (take) {
      copy(src, dst);
      state.synced[rel] = srcHash;
      changed++;
    }
  }
  return changed;
}

function mergeOut(local, state) {
  let changed = 0;
  for (const rel of listLocal(local)) {
    const src = path.join(local, rel);
    const dst = path.join(cloneDir, toRepo(rel));
    const srcHash = hashOf(src);
    const dstHash = hashOf(dst);
    if (srcHash === dstHash) continue;
    if (!isSession(rel) || !dstHash || sizeOf(src) >= sizeOf(dst)) {
      copy(src, dst);
      changed++;
    }
    state.synced[rel] = srcHash;
  }
  return changed;
}

// ── Commands ─────────────────────────────────────────────────
function emit(message) {
  if (!message) return;
  if (HOOK) process.stdout.write(JSON.stringify({ systemMessage: `claude-sync: ${message}`, suppressOutput: true }));
  else console.log(message);
}

function saveState(state) {
  fs.mkdirSync(syncRoot, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 1));
}

function run(state) {
  const local = localProjectDir();
  switch (cmd) {
    case 'setup':
    case 'pull': {
      ensureClone();
      fetchLatest();
      const n = mergeIn(local, state);
      saveState(state);
      if (cmd === 'setup') {
        emit(`Sync repo: ${repoUrl}\nConversations and memory now in: ${local}\n` +
          `${n} file(s) pulled. Open this folder in Claude Code; use \`claude --resume\` here to continue a synced conversation.`);
      } else if (n > 0 || !HOOK) {
        emit(n > 0 ? `pulled ${n} conversation/memory file(s) from your other computer` : 'already up to date');
      }
      return;
    }
    case 'push': {
      if (argv.includes('--debounce') && Date.now() - (state.lastPush ?? 0) < DEBOUNCE_MS) return;
      ensureClone();
      let pushed = false;
      for (let attempt = 0; ; attempt++) {
        fetchLatest();
        mergeIn(local, state);
        mergeOut(local, state);
        try {
          pushed = commitAndPush();
          break;
        } catch (e) {
          if (attempt >= 1) throw e; // someone pushed in between: refetch and retry once
        }
      }
      state.lastPush = Date.now();
      delete state.lastError;
      saveState(state);
      if (!HOOK) emit(pushed ? 'pushed conversations and memory' : 'nothing new to push');
      return;
    }
    case 'status': {
      const files = listLocal(local);
      const cloned = fs.existsSync(path.join(cloneDir, '.git'));
      emit([
        `Sync repo:      ${repoUrl ?? '(not configured)'}`,
        `Local clone:    ${cloneDir}${cloned ? '' : ' (not cloned yet — run: npm run setup)'}`,
        `Claude history: ${local}`,
        `Local files:    ${files.filter(isSession).length} conversation(s), ${files.filter((f) => !isSession(f)).length} memory file(s)`,
        cloned ? `In sync repo:   ${listRepo().filter((f) => f.startsWith('sessions/')).length} conversation(s)` : '',
        `Last push:      ${state.lastPush ? new Date(state.lastPush).toLocaleString() : 'never'}`,
        state.lastError ? `Last error:     ${state.lastError}` : '',
      ].filter(Boolean).join('\n'));
      return;
    }
    default:
      throw new Error(`unknown command "${cmd}" (use setup, pull, push or status)`);
  }
}

const state = readJson(statePath, { synced: {}, lastPush: 0 });
state.synced ??= {};
try {
  run(state);
} catch (e) {
  const detail = String(e?.stderr || e?.message || e).split('\n').map((l) => l.trim()).find(Boolean) ?? 'unknown error';
  state.lastError = `${new Date().toLocaleString()}: ${detail}`;
  try {
    saveState(state);
  } catch {
    /* ignore */
  }
  if (HOOK) {
    if (cmd === 'pull') emit(`skipped (${detail}) — run \`npm run sync:status\` for details`);
  } else {
    console.error(`claude-sync ${cmd} failed: ${detail}`);
    process.exitCode = 1;
  }
}
