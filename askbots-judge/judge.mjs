#!/usr/bin/env node
/**
 * AskBots judge harness for MoniBot.
 *
 * Celo "Agentic Payments & DeFAI" hackathon — Track 3 (AskBots).
 * The bot reviews a matched project's propertyUrl, submits answers, then
 * solves the anti-human math challenge in the same run to beat the ~2000ms
 * timeout and collect $0.10 USDT on Celo.
 *
 * Workflow is deliberately human-in-the-loop: the track is judged on builder
 * ratings, so each answer set is reviewed before submit. A blind auto-spammer
 * would earn thumbs-down and cap the daily limit at 1.
 *
 * Two INDEPENDENT agents are supported. They never share credentials or answer
 * files — pick one per run with `--agent` (default: monibot):
 *   monibot     payments/infra lane   → ~/.config/askbots/credentials.json
 *   spacedrift  games lane            → ~/.config/askbots-spacedrift/credentials.json
 *
 * Usage:
 *   node judge.mjs [--agent <monibot|spacedrift>] status
 *   node judge.mjs [--agent ...] list                   # matched projects
 *   node judge.mjs [--agent ...] show <projectId>       # full detail + questions
 *   node judge.mjs [--agent ...] scaffold <projectId>   # write answers/<agent>/<id>.json
 *   node judge.mjs [--agent ...] submit <projectId>     # respond + auto-solve challenge
 *   node judge.mjs [--agent ...] ratings                # thumbs up/down history
 *
 * Key resolution: ASKBOTS_API_KEY env overrides everything; otherwise the
 * selected agent's credentials.json is used.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://main--askbots.netlify.app/api";
const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// ---------- agent selection (keeps the two identities fully separate) ----------
const AGENTS = {
  monibot:    { credDir: "askbots",            label: "MoniBot (payments/infra)" },
  spacedrift: { credDir: "askbots-spacedrift", label: "SpaceDrift (games)" },
};
// parse a leading/anywhere `--agent <name>` out of argv
const argv = process.argv.slice(2);
let AGENT = process.env.ASKBOTS_AGENT || "monibot";
const ai = argv.indexOf("--agent");
if (ai !== -1) { AGENT = argv[ai + 1]; argv.splice(ai, 2); }
if (!AGENTS[AGENT]) {
  console.error(`Unknown agent "${AGENT}". Use one of: ${Object.keys(AGENTS).join(", ")}`);
  process.exit(1);
}
const ANSWERS_DIR = join(HERE, "answers", AGENT);
mkdirSync(ANSWERS_DIR, { recursive: true });

// ---------- credentials ----------
function loadKey() {
  if (process.env.ASKBOTS_API_KEY) return process.env.ASKBOTS_API_KEY.trim();
  const p = join(homedir(), ".config", AGENTS[AGENT].credDir, "credentials.json");
  if (existsSync(p)) {
    const c = JSON.parse(readFileSync(p, "utf8"));
    if (c.apiKey) return c.apiKey.trim();
  }
  console.error(`No API key for "${AGENT}". Set ASKBOTS_API_KEY or ${p}`);
  process.exit(1);
}
const KEY = loadKey();

// ---------- http ----------
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json };
}

// ---------- anti-human math solver ----------
// Exact integer arithmetic via BigInt with correct precedence (*, / before +, -).
// Handles the documented `rapid_math` prompts e.g. "What is 847293 * 193847 + 582910384?"
function solveMath(prompt) {
  const m = String(prompt).match(/[-+*/x×·\d\s().]+/g);
  if (!m) throw new Error(`No expression found in prompt: ${prompt}`);
  // pick the longest matched chunk (the actual expression, not stray digits)
  let expr = m.sort((a, b) => b.length - a.length)[0]
    .replace(/[x×]/g, "*")
    .replace(/·/g, "*")
    .trim();

  const tokens = expr.match(/\d+|[-+*/()]/g);
  if (!tokens) throw new Error(`No tokens in expression: ${expr}`);

  // shunting-yard → RPN, evaluated in BigInt
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const out = [], ops = [];
  for (const t of tokens) {
    if (/^\d+$/.test(t)) out.push(BigInt(t));
    else if (t in prec) {
      while (ops.length && ops.at(-1) !== "(" && prec[ops.at(-1)] >= prec[t]) out.push(ops.pop());
      ops.push(t);
    } else if (t === "(") ops.push(t);
    else if (t === ")") {
      while (ops.length && ops.at(-1) !== "(") out.push(ops.pop());
      ops.pop();
    }
  }
  while (ops.length) out.push(ops.pop());

  const st = [];
  for (const t of out) {
    if (typeof t === "bigint") { st.push(t); continue; }
    const b = st.pop(), a = st.pop();
    if (t === "+") st.push(a + b);
    else if (t === "-") st.push(a - b);
    else if (t === "*") st.push(a * b);
    else if (t === "/") st.push(a / b); // integer division
  }
  return st[0].toString();
}

// ---------- commands ----------
async function cmdStatus() {
  const auth = await api("POST", "/auth/openclaw", {});
  const prof = await api("GET", "/bot-profiles/me");
  console.log("AUTH  ", auth.status, JSON.stringify(auth.json));
  if (prof.ok) {
    const p = prof.json;
    console.log("PROFILE",
      `\n  bot        : ${p.botName}`,
      `\n  rating     : ${p.rating}`,
      `\n  reviews    : ${p.totalReviews}`,
      `\n  active     : ${p.activeAssignments}`,
      `\n  payout     : ${p.celoAddress}`,
      `\n  skills     : ${(p.skills || []).join(", ")}`,
      `\n  dailyLimit : ${p.dailyLimit ? `${p.dailyLimit.currentCount}/${p.dailyLimit.limit} used, ${p.dailyLimit.remaining} left` : "?"}`);
  } else {
    console.log("PROFILE", prof.status, JSON.stringify(prof.json));
  }
}

async function cmdList() {
  const r = await api("GET", "/projects");
  if (!r.ok) return console.log(r.status, JSON.stringify(r.json));
  const projects = r.json.projects || [];
  console.log(`${projects.length} matched projects:\n`);
  for (const p of projects) {
    const q = (p.questions || []).length;
    console.log(
      `${p.status === "active" ? "🟢" : "⚪"} ${p._id}`,
      `\n   ${p.name}`,
      `\n   ${p.propertyType} · ${p.propertyUrl}`,
      `\n   $${p.costPerResponse}/resp · ${q} questions · received ${p.responsesReceived} · status ${p.status}\n`);
  }
}

async function cmdShow(id) {
  const r = await api("GET", `/projects/${id}`);
  console.log(r.status);
  console.log(JSON.stringify(r.json, null, 2));
}

async function cmdScaffold(id) {
  const r = await api("GET", `/projects/${id}`);
  if (!r.ok) return console.log("Could not fetch project", r.status, JSON.stringify(r.json));
  const p = r.json.project || r.json;
  const questions = p.questions || [];
  const template = {
    projectId: id,
    name: p.name,
    propertyUrl: p.propertyUrl,
    answers: questions.map((q) => ({
      questionId: q.id,
      _text: q.text,
      _type: q.type,
      ...(q.choices ? { _choices: q.choices } : {}),
      answer: q.type === "rating" ? "" : q.type === "multiselect" ? "[]" : "",
    })),
  };
  const path = join(ANSWERS_DIR, `${id}.json`);
  writeFileSync(path, JSON.stringify(template, null, 2));
  console.log(`Scaffolded ${questions.length} questions →`, path);
  console.log("Fill in every `answer` field, then: node judge.mjs submit", id);
}

async function cmdSubmit(id) {
  const path = join(ANSWERS_DIR, `${id}.json`);
  if (!existsSync(path)) return console.log("No answers file. Run: node judge.mjs scaffold", id);
  const data = JSON.parse(readFileSync(path, "utf8"));

  const answers = data.answers.map((a) => ({ questionId: a.questionId, answer: a.answer }));
  const blank = answers.filter((a) => a.answer === "" || a.answer == null);
  if (blank.length) {
    console.log(`Refusing to submit: ${blank.length} blank answer(s). Fill them in first.`);
    return;
  }

  console.log(`Submitting ${answers.length} answers to "${data.name}"…`);
  const resp = await api("POST", `/projects/${id}/respond`, { answers });
  if (!resp.ok) return console.log("respond failed", resp.status, JSON.stringify(resp.json));

  const ch = resp.json.challenge || resp.json;
  const challengeId = ch.challengeId || ch.id;
  const prompt = ch.prompt;
  const timeoutMs = ch.timeoutMs || 2000;
  if (!challengeId || !prompt) {
    console.log("Unexpected respond payload:", JSON.stringify(resp.json, null, 2));
    return;
  }

  const t0 = Date.now();
  const answer = solveMath(prompt);
  const solveMs = Date.now() - t0;
  console.log(`Challenge: "${prompt}"  → ${answer}  (solved in ${solveMs}ms, budget ${timeoutMs}ms)`);

  const verify = await api("POST", `/projects/${id}/verify-challenge`, { challengeId, answer });
  const elapsed = Date.now() - t0;
  if (verify.ok && (verify.json.passed ?? true)) {
    const j = verify.json;
    const payout = j.payout ?? j.amount ?? j.reward ?? j.payment?.amount;
    const tx = j.payoutTxHash ?? j.txHash ?? j.txhash ?? j.transactionHash ?? j.payment?.txHash ?? j.tx;
    console.log(`✅ PASSED in ${elapsed}ms total`);
    console.log(`   payout : ${payout ?? "(see raw)"} ${j.currency ?? "USDT"}`);
    console.log(`   txHash : ${tx ?? "(see raw)"}`);
    console.log(`   raw    : ${JSON.stringify(j)}`);
  } else {
    console.log(`❌ verify failed (${elapsed}ms)`, verify.status, JSON.stringify(verify.json));
    console.log("   You can retry: node judge.mjs submit", id);
  }
}

async function cmdRatings() {
  const r = await api("GET", "/bot-profiles/me/ratings");
  console.log(r.status, JSON.stringify(r.json, null, 2));
}

// ---------- dispatch ----------
const [cmd, arg] = argv;
console.error(`[agent: ${AGENTS[AGENT].label}]`);
const cmds = {
  status: cmdStatus,
  list: cmdList,
  show: () => cmdShow(arg),
  scaffold: () => cmdScaffold(arg),
  submit: () => cmdSubmit(arg),
  ratings: cmdRatings,
};
if (!cmds[cmd]) {
  console.log("Commands: status | list | show <id> | scaffold <id> | submit <id> | ratings");
  process.exit(0);
}
await cmds[cmd]();
