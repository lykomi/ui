#!/usr/bin/env node
/**
 * Fails the build if a restricted term appears anywhere in the repository.
 *
 * This is an open-source repository developed alongside private deployments.
 * Identifiers that belong to those deployments — organisation names, tenant
 * names, internal project names — must not appear here, in any surface:
 *
 *   - source code and comments
 *   - `.changeset/*.md` entries, and the `CHANGELOG.md` files generated from them
 *   - documentation
 *   - commit messages
 *
 * Commit messages matter as much as file contents: anything reachable from a
 * pull-request ref is retained by the forge indefinitely, so rewriting a branch
 * afterwards does not undo it. The only inexpensive moment to catch a mistake
 * is before it is pushed.
 *
 * WHY THE TERM LIST IS HASHED
 * ---------------------------
 * A readable list of restricted terms would itself disclose them. So
 * `sensitive-terms.json` stores salted SHA-256 hashes of individual lowercased
 * tokens instead.
 *
 * Be clear-eyed about what that buys: this is OBFUSCATION, NOT SECRECY. The
 * salt is public, so anyone determined can confirm a guess. What it does
 * prevent is the realistic exposure — a reader, a grep, or a search-engine
 * crawler picking the list up for free.
 *
 * Matching is token-based rather than substring-based: text is lowercased and
 * split on non-alphanumerics, so `Example-dev`, `Example Contracts` and
 * `example_test` all reduce to the token `example` and are all caught, while an
 * unrelated word that merely contains those letters is not.
 *
 * USAGE
 *   node scripts/check-sensitive-terms.mjs                 # working tree
 *   node scripts/check-sensitive-terms.mjs --staged        # staged changes (pre-commit)
 *   node scripts/check-sensitive-terms.mjs --range a..b    # files + commit messages in a range
 *   node scripts/check-sensitive-terms.mjs --add "Term"    # print the hash to add to the list
 *
 * Findings are reported as file:line only. The matched term is NEVER echoed —
 * build logs are as public as the repository.
 */

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TERMS_FILE = "scripts/sensitive-terms.json";
const TERMS_PATH = join(ROOT, TERMS_FILE);

/** Tokens shorter than this are too collision-prone to be worth matching. */
const MIN_TOKEN_LENGTH = 4;

/** Binary/large assets where a text scan is meaningless or misleading. */
const SKIP_EXT =
  /\.(png|jpe?g|gif|webp|avif|ico|svg|woff2?|ttf|eot|pdf|zip|gz|tgz|mp4|webm|wasm)$/i;

/** Paths that are generated or vendored. */
const SKIP_PATH = /(^|\/)(node_modules|dist|build|coverage|\.git)\//;

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

function loadTerms() {
  if (!existsSync(TERMS_PATH)) {
    console.error(`✗ missing term list: ${TERMS_PATH}`);
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(TERMS_PATH, "utf8"));
  if (!raw.salt || !Array.isArray(raw.tokens)) {
    console.error(`✗ ${TERMS_FILE} must have { salt, tokens[] }`);
    process.exit(2);
  }
  return { salt: raw.salt, hashes: new Set(raw.tokens) };
}

const hashToken = (salt, token) => createHash("sha256").update(`${salt}:${token}`).digest("hex");

/** Lowercase, split on non-alphanumerics, drop short tokens. */
function tokenize(text) {
  const out = [];
  for (const t of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (t.length >= MIN_TOKEN_LENGTH) out.push(t);
  }
  return out;
}

/** Returns the 1-based line numbers of `text` that contain a restricted token. */
function scanText(text, { salt, hashes }) {
  const bad = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const token of tokenize(lines[i])) {
      if (hashes.has(hashToken(salt, token))) {
        bad.push(i + 1);
        break; // one report per line; never reveal which token matched
      }
    }
  }
  return bad;
}

function scannableFiles(list) {
  return list.filter((f) => f && !SKIP_EXT.test(f) && !SKIP_PATH.test(`/${f}`) && f !== TERMS_FILE);
}

function readIfText(file) {
  try {
    const buf = readFileSync(join(ROOT, file));
    if (buf.includes(0)) return null; // NUL byte ⇒ binary
    return buf.toString("utf8");
  } catch {
    return null; // deleted / unreadable in this mode
  }
}

// --- entrypoint ------------------------------------------------------------

const argv = process.argv.slice(2);

const addIndex = argv.indexOf("--add");
if (addIndex !== -1) {
  const term = argv[addIndex + 1];
  if (!term || term.startsWith("-")) {
    console.error('Usage: node scripts/check-sensitive-terms.mjs --add "Term"');
    process.exit(1);
  }
  const { salt } = loadTerms();
  const tokens = [...new Set(tokenize(term))];
  if (tokens.length === 0) {
    console.error(`✗ no token of length >= ${MIN_TOKEN_LENGTH} in that input`);
    process.exit(1);
  }
  console.log(`Add these to ${TERMS_FILE} → tokens:`);
  for (const t of tokens) console.log(`  "${hashToken(salt, t)}",`);
  console.log("\n(The plaintext is intentionally not written to the file.)");
  process.exit(0);
}

const terms = loadTerms();
const rangeIndex = argv.indexOf("--range");
const staged = argv.includes("--staged");

let files;
let messages = [];
let mode;

if (rangeIndex !== -1) {
  const range = argv[rangeIndex + 1];
  if (!range || range.startsWith("-")) {
    console.error("Usage: node scripts/check-sensitive-terms.mjs --range <base>..<head>");
    process.exit(1);
  }
  mode = `range ${range}`;
  files = git(["diff", "--name-only", "--diff-filter=ACMR", range]).split("\n");
  const log = git(["log", "--format=%H%x00%B%x00", range]);
  for (const entry of log.split("\0\0")) {
    const [sha, body] = entry.split("\0");
    if (sha && body) messages.push({ sha: sha.trim(), body });
  }
} else if (staged) {
  mode = "staged changes";
  files = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]).split("\n");
} else {
  // Tracked files PLUS untracked-but-not-ignored ones. A file just created is
  // exactly the case worth catching, and `git ls-files` alone would not see it
  // until after `git add`.
  mode = "working tree";
  files = [
    ...git(["ls-files"]).split("\n"),
    ...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ];
}

let findings = 0;

for (const file of scannableFiles(files)) {
  const text = readIfText(file);
  if (text === null) continue;
  for (const line of scanText(text, terms)) {
    console.error(`✗ ${file}:${line} — restricted term`);
    findings++;
  }
}

for (const { sha, body } of messages) {
  if (scanText(body, terms).length > 0) {
    console.error(`✗ commit ${sha.slice(0, 12)} — restricted term in the commit message`);
    findings++;
  }
}

if (findings > 0) {
  console.error(
    `\n✗ ${findings} occurrence(s) found (${mode}).\n` +
      "  Restricted identifiers must not appear in this repository — in code,\n" +
      "  comments, changesets, changelogs, documentation, or commit messages.\n" +
      "  The term is deliberately not printed here; check the lines above and\n" +
      '  rephrase generically (for example "a downstream app", "a deployment").\n' +
      "  If a commit message is at fault, amend or rebase before pushing.",
  );
  process.exit(1);
}

console.log(`✓ no restricted terms (${mode})`);
