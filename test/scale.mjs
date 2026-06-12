// Scale test: N real WebSocket clients in ONE room, doing what a real big retro does —
// concurrent joins, a burst of stickies, dot-votes, reactions, and a cursor storm —
// then assert every client converged to the same state and report timings.
//
//   node test/scale.mjs                       → local (run wrangler dev first)
//   HOST=wss://scrumlo.com node test/scale.mjs → production
//   N=20 node test/scale.mjs                  → bigger room

const HOST = process.env.HOST || "ws://localhost:8787";
const N = Math.max(3, Math.min(30, Number(process.env.N) || 16));
const COL = "start";
const room = `scaletest-${Date.now().toString(36)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(name, cid) {
    this.name = name;
    this.snap = null;
    this.snapCount = 0;
    this.cursorFrames = 0;
    this.ended = false;
    this.ws = new WebSocket(`${HOST}/ws?room=${room}`);
    this.ready = new Promise((res, rej) => {
      this.ws.addEventListener("open", () => {
        this.send({ t: "hello", v: 1, name, clientId: cid });
        res();
      });
      this.ws.addEventListener("error", (e) => rej(new Error(`${name}: socket error ${e.message ?? ""}`)));
    });
    this.ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.t === "snapshot") {
        this.snap = m;
        this.snapCount++;
      } else if (m.t === "cursors") this.cursorFrames++;
      else if (m.t === "ended") this.ended = true;
    });
  }
  send(m) {
    this.ws.send(JSON.stringify(m));
  }
  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

/** Wait until pred(client) holds for EVERY client, or fail with who's behind. */
async function converge(clients, pred, label, timeoutMs = 15000) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    if (clients.every(pred)) return Math.round(performance.now() - t0);
    await sleep(60);
  }
  const lagging = clients.filter((c) => !pred(c)).map((c) => c.name);
  throw new Error(`${label}: ${lagging.length}/${clients.length} clients never converged (${lagging.slice(0, 5).join(", ")})`);
}

const t = (label, ms) => console.log(`  ${label.padEnd(44)} ${String(ms).padStart(6)} ms`);
console.log(`Scale test → ${HOST} · room ${room} · ${N} clients\n`);

// ---- 1. concurrent join ----
let t0 = performance.now();
const clients = [];
for (let i = 0; i < N; i++) clients.push(new Client(`User${String(i + 1).padStart(2, "0")}`, `cid-${room}-${i}`));
await Promise.all(clients.map((c) => c.ready));
const joinMs = await converge(clients, (c) => c.snap?.members?.length === N, "join");
t(`${N} clients joined, everyone sees everyone`, Math.round(performance.now() - t0));

// ---- 2. switch to retro (concurrent joins race for the baton — find who actually won) ----
const facil = clients.find((c) => c.snap.you && c.snap.you === c.snap.facilitator);
if (!facil) throw new Error("no facilitator emerged from the concurrent join");
console.log(`  facilitator: ${facil.name} (concurrent join race)`);
facil.send({ t: "switchActivity", v: 1, activity: "retro" });
await converge(clients, (c) => c.snap?.activity === "retro", "switch to retro");

// ---- 3. sticky burst: everyone adds 3, humanly paced ----
t0 = performance.now();
for (let round = 0; round < 3; round++) {
  for (const c of clients) c.send({ t: "retroAddCard", v: 1, column: COL, text: `${c.name} idea ${round + 1}` });
  await sleep(180); // a person taking a breath between stickies
}
const stickyMs = await converge(clients, (c) => c.snap?.retro?.cards?.length === N * 3, "sticky burst");
t(`${N * 3} stickies added by ${N} people, all converged`, Math.round(performance.now() - t0));

// ---- 4. everyone dot-votes their own first card + the facilitator's ----
t0 = performance.now();
facil.send({ t: "retroSetPhase", v: 1, phase: "vote" });
await converge(clients, (c) => c.snap?.retro?.phase === "vote", "vote phase");
const firstCard = clients[0].snap.retro.cards[0].id;
for (const c of clients) c.send({ t: "retroVote", v: 1, cardId: firstCard });
const votesMs = await converge(
  clients,
  (c) => (c.snap?.retro?.cards ?? []).find((k) => k.id === firstCard)?.votes === N,
  "votes",
);
t(`${N} votes on one card, all converged`, Math.round(performance.now() - t0));

// ---- 5. reaction pile-on ----
t0 = performance.now();
for (const c of clients) c.send({ t: "retroReact", v: 1, cardId: firstCard, emoji: "🔥" });
await converge(
  clients,
  (c) => ((c.snap?.retro?.cards ?? []).find((k) => k.id === firstCard)?.reactions ?? []).some((r) => r.count === N),
  "reactions",
);
t(`${N} reactions on one card, all converged`, Math.round(performance.now() - t0));

// ---- 6. cursor storm: everyone streams 25 frames at 50ms (a busy group phase) ----
t0 = performance.now();
for (const c of clients) c.cursorFrames = 0;
for (let f = 0; f < 25; f++) {
  for (const c of clients) c.send({ t: "cursor", v: 1, x: 100 + f * 7, y: 200 + f * 3 });
  await sleep(50);
}
await sleep(600);
const frames = clients.map((c) => c.cursorFrames);
const minF = Math.min(...frames);
const maxF = Math.max(...frames);
t(`cursor storm (${N * 25} sends), frames received`, Math.round(performance.now() - t0));
console.log(`  cursor fan-out per client: ${minF}–${maxF} coalesced frames (server batches ~50ms)`);

// ---- 7. final consistency: every snapshot agrees ----
const sig = (c) =>
  JSON.stringify({
    members: c.snap.members.length,
    cards: c.snap.retro.cards.length,
    votes: c.snap.retro.cards.reduce((a, k) => a + k.votes, 0),
  });
const sigs = new Set(clients.map(sig));
if (sigs.size !== 1) throw new Error(`final state diverged: ${[...sigs].join(" vs ")}`);
console.log(`\n  ✓ all ${N} clients ended on the identical state: ${[...sigs][0]}`);
const dead = clients.filter((c) => c.ended || c.ws.readyState !== WebSocket.OPEN);
if (dead.length) throw new Error(`${dead.length} sockets died during the run`);
console.log(`  ✓ all ${N} sockets alive end to end`);
console.log(`  ✓ convergence: join ${joinMs}ms · stickies ${stickyMs}ms · votes ${votesMs}ms`);

for (const c of clients) c.close();
console.log("\nScale test passed.");
