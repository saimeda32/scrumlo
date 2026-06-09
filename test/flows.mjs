// End-to-end user-flow tests. Drives the real worker over WebSockets the way the
// browser client does, then asserts on the snapshots each user receives. Run the
// worker first (pnpm build && npx wrangler dev --port 8787), then: node test/flows.mjs
//
// Each flow gets its own room (fresh Durable Object) so they cannot bleed into each
// other. The point is to catch broken basic flows before a human has to.

import { parseStoryList } from "../src/lib/parseStories.ts";

const HOST = process.env.HOST || "ws://localhost:8787";
// What the EstimateBoard actually sends: it parses the textarea client-side, then
// ships the resulting array. The tests mirror that so they exercise the real parser.
const addStories = (c, text) => c.send({ t: "estimateQueueAdd", v: 1, stories: parseStoryList(text) });
const COL = "start"; // a valid Start/Stop/Continue column id
let roomSeq = 0;
const newRoom = () => `flowtest-${Date.now().toString(36)}-${roomSeq++}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(room, name, cid) {
    this.name = name;
    this.snap = null;
    this.spots = [];
    this.emotes = [];
    this.cursors = [];
    this.ended = false;
    this.ws = new WebSocket(`${HOST}/ws?room=${room}`);
    this.ready = new Promise((res) => {
      this.ws.addEventListener("open", () => {
        if (name) this.send({ t: "hello", v: 1, name, clientId: cid });
        else this.send({ t: "sync", v: 1 });
        res();
      });
    });
    this.ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.t === "snapshot") this.snap = m;
      else if (m.t === "spotlight") this.spots.push(m);
      else if (m.t === "emote") this.emotes.push(m);
      else if (m.t === "cursors") this.cursors = m.cursors;
      else if (m.t === "ended") this.ended = true;
    });
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  close() { try { this.ws.close(); } catch {} }
  get est() { return this.snap.estimate; }
  myCardText(authorClientNameMatchUnused) { return this.snap.retro.cards; }
}

async function room(names) {
  const r = newRoom();
  const clients = [];
  for (let i = 0; i < names.length; i++) {
    const c = new Client(r, names[i], `cid-${r}-${i}`);
    await c.ready;
    clients.push(c);
    await sleep(120); // keep join order deterministic (first = facilitator)
  }
  await sleep(250);
  return clients;
}

// --- tiny assert framework ---
const results = [];
let current = null;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function eq(a, b, msg) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg}\n      expected ${B}\n      got      ${A}`);
}
async function flow(name, fn) {
  current = name;
  const clients = [];
  const track = (cs) => { clients.push(...cs); return cs; };
  try {
    await fn(track);
    results.push({ name, ok: true });
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}\n        ${e.message.replace(/\n/g, "\n        ")}`);
  } finally {
    clients.forEach((c) => c.close());
    await sleep(60);
  }
}

console.log("\nScrumlo end-to-end flow tests\n");

// ============================ ESTIMATE ============================
await flow("estimate: comma list adds many stories at once", async (t) => {
  const [a] = t(await room(["Alice"]));
  addStories(a, "Login page, Billing export, Search filters");
  await sleep(250);
  eq(a.est.story, "Login page", "first comma item becomes current story");
  eq(a.est.queue, ["Billing export", "Search filters"], "rest queue up");
});

await flow("estimate: newline list adds many stories", async (t) => {
  const [a] = t(await room(["Alice"]));
  addStories(a, "A\nB\nC");
  await sleep(250);
  eq(a.est.story, "A", "first line current");
  eq(a.est.queue, ["B", "C"], "rest queued");
});

await flow("estimate: CSV/Jira row stays one story, points stripped", async (t) => {
  const [a] = t(await room(["Alice"]));
  addStories(a, "PROJ-12, Add CSV export, 5");
  await sleep(250);
  eq(a.est.story, "PROJ-12 · Add CSV export", "id + title, number dropped");
  eq(a.est.queue, [], "no extra stories from a CSV row");
});

await flow("estimate: mixed CSV row + plain comma line in one paste", async (t) => {
  const [a] = t(await room(["Alice"]));
  addStories(a, "PROJ-1, Real CSV row, 8\nquick one, quick two");
  await sleep(250);
  eq(a.est.story, "PROJ-1 · Real CSV row", "csv line is one story");
  eq(a.est.queue, ["quick one", "quick two"], "plain comma line splits");
});

await flow("estimate: votes hidden until reveal, voted list shown", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "vote", v: 1, card: "5" });
  await sleep(250);
  eq(b.est.votes, null, "Bob cannot see raw votes before reveal");
  assert(b.est.voted.length === 1, "voted list shows one voter");
  eq(b.est.yourVote, null, "Bob has not voted yet");
});

await flow("estimate: auto-reveals when all present have voted", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "vote", v: 1, card: "5" });
  b.send({ t: "vote", v: 1, card: "8" });
  await sleep(300);
  eq(a.est.phase, "revealed", "phase flips to revealed at 2/2");
  assert(a.est.votes && Object.keys(a.est.votes).length === 2, "both votes now visible");
});

await flow("estimate: non-facilitator cannot reveal", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "vote", v: 1, card: "5" }); // only 1/2 voted, no auto-reveal
  await sleep(200);
  b.send({ t: "reveal", v: 1 }); // Bob is not facilitator
  await sleep(250);
  eq(a.est.phase, "voting", "still hidden, non-facilitator reveal ignored");
});

await flow("estimate: Next story records consensus and advances", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  addStories(a, "Story one, Story two");
  await sleep(200);
  a.send({ t: "vote", v: 1, card: "5" });
  b.send({ t: "vote", v: 1, card: "5" });
  await sleep(300);
  a.send({ t: "estimateNextStory", v: 1 });
  await sleep(300);
  eq(a.est.log.map((l) => `${l.story}=${l.value}`), ["Story one=5"], "story one logged at consensus 5");
  eq(a.est.story, "Story two", "advanced to story two");
  eq(a.est.phase, "voting", "fresh voting round");
});

await flow("estimate: Record button finalizes the LAST story (queue empty)", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "estimateQueueAdd", v: 1, stories: ["Only story"] });
  await sleep(200);
  a.send({ t: "vote", v: 1, card: "13" });
  b.send({ t: "vote", v: 1, card: "13" });
  await sleep(300);
  a.send({ t: "estimateNextStory", v: 1 }); // queue empty, must still record
  await sleep(300);
  eq(a.est.log.map((l) => `${l.story}=${l.value}`), ["Only story=13"], "last story recorded");
  eq(a.est.story, "", "no current story left");
});

await flow("estimate: a story with no votes is skipped, not logged", async (t) => {
  const [a] = t(await room(["Alice"]));
  addStories(a, "Skip me, Keep me");
  await sleep(200);
  a.send({ t: "estimateNextStory", v: 1 }); // no votes on "Skip me"
  await sleep(250);
  eq(a.est.log, [], "skipped story not logged");
  eq(a.est.story, "Keep me", "advanced anyway");
});

await flow("estimate: locked decision overrides consensus", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  addStories(a, "S1, S2");
  await sleep(200);
  a.send({ t: "vote", v: 1, card: "3" });
  b.send({ t: "vote", v: 1, card: "3" });
  await sleep(300);
  a.send({ t: "lockDecision", v: 1, value: "8", note: "risk buffer" });
  await sleep(200);
  a.send({ t: "estimateNextStory", v: 1 });
  await sleep(250);
  eq(a.est.log[0].value, "8", "locked 8 beats consensus 3");
  eq(a.est.log[0].note, "risk buffer", "note carried");
});

await flow("estimate: reestimate keeps rationale, clears votes", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "vote", v: 1, card: "3" });
  b.send({ t: "vote", v: 1, card: "13" });
  await sleep(250); // auto-revealed
  a.send({ t: "setRationale", v: 1, text: "it is bigger than it looks" });
  await sleep(200);
  a.send({ t: "reestimate", v: 1 });
  await sleep(250);
  eq(a.est.phase, "voting", "reopened for voting");
  assert(!a.est.votes || Object.keys(a.est.votes).length === 0, "votes cleared");
  assert(a.est.rationales && Object.values(a.est.rationales).some((r) => r.includes("bigger")), "rationale kept");
});

await flow("estimate: restart wipes votes and rationales", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "vote", v: 1, card: "3" });
  b.send({ t: "vote", v: 1, card: "5" });
  await sleep(250);
  a.send({ t: "restart", v: 1 });
  await sleep(250);
  eq(a.est.phase, "voting", "back to voting");
  eq(a.est.decision, null, "decision cleared");
  assert(!a.est.rationales || Object.keys(a.est.rationales).length === 0, "rationales cleared");
});

await flow("estimate: custom deck accepted and votable", async (t) => {
  const [a] = t(await room(["Alice"]));
  a.send({ t: "setCustomDeck", v: 1, cards: ["XS", "S", "M", "L", "XL"] });
  await sleep(200);
  eq(a.est.deck, "custom", "deck switched to custom");
  eq(a.est.customDeck, ["XS", "S", "M", "L", "XL"], "custom cards present");
  a.send({ t: "vote", v: 1, card: "M" });
  await sleep(200);
  eq(a.est.yourVote, "M", "can vote a custom value");
});

await flow("estimate: changing deck resets votes", async (t) => {
  const [a] = t(await room(["Alice"]));
  a.send({ t: "vote", v: 1, card: "5" });
  await sleep(200);
  a.send({ t: "setDeck", v: 1, deck: "tshirt" });
  await sleep(200);
  eq(a.est.yourVote, null, "vote cleared on deck change");
});

await flow("estimate: queue remove and reorder", async (t) => {
  const [a] = t(await room(["Alice"]));
  addStories(a, "cur, q0, q1, q2");
  await sleep(200);
  eq(a.est.queue, ["q0", "q1", "q2"], "queue seeded");
  a.send({ t: "estimateQueueReorder", v: 1, from: 0, to: 2 });
  await sleep(200);
  eq(a.est.queue, ["q1", "q2", "q0"], "reordered");
  a.send({ t: "estimateQueueRemove", v: 1, index: 1 });
  await sleep(200);
  eq(a.est.queue, ["q1", "q0"], "removed index 1");
});

// ============================ RETRO ============================
await flow("retro: card content is visible to everyone by default", async (t) => {
  const [a, b, c] = t(await room(["Alice", "Bob", "Cara"]));
  a.send({ t: "switchActivity", v: 1, activity: "retro" });
  await sleep(150);
  b.send({ t: "retroAddCard", v: 1, column: COL, text: "Bob open idea" });
  await sleep(250);
  const onCara = c.snap.retro.cards.find((x) => x.text === "Bob open idea");
  assert(onCara && !onCara.masked, "a non-facilitator reads Bob's note with no blind toggle on");
  eq(c.snap.retro.blind, false, "blind is off by default");
});

await flow("retro: facilitator blinds content (others masked, host still sees), then reveals", async (t) => {
  const [a, b, c] = t(await room(["Alice", "Bob", "Cara"])); // Alice is the facilitator
  a.send({ t: "switchActivity", v: 1, activity: "retro" });
  await sleep(150);
  a.send({ t: "retroSetBlind", v: 1, on: true });
  await sleep(150);
  b.send({ t: "retroAddCard", v: 1, column: COL, text: "Bob blind idea" });
  await sleep(300);
  // Cara is neither facilitator nor author: she sees a masked card with no text.
  assert(!c.snap.retro.cards.some((x) => x.text === "Bob blind idea"), "Cara cannot read the blinded content");
  assert(c.snap.retro.cards.some((x) => x.masked && x.text === ""), "Cara sees it masked");
  // The facilitator still sees everything, and the author sees their own.
  assert(a.snap.retro.cards.some((x) => x.text === "Bob blind idea"), "the facilitator still sees all content");
  assert(b.snap.retro.cards.some((x) => x.text === "Bob blind idea"), "the author sees their own card");
  // Reveal for the room.
  a.send({ t: "retroSetBlind", v: 1, on: false });
  await sleep(250);
  assert(c.snap.retro.cards.some((x) => x.text === "Bob blind idea"), "Cara sees content once the host reveals");
});

await flow("retro: vote increments count and youVoted", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "switchActivity", v: 1, activity: "retro" });
  await sleep(150);
  a.send({ t: "retroAddCard", v: 1, column: COL, text: "card" });
  await sleep(200);
  a.send({ t: "retroSetPhase", v: 1, phase: "vote" });
  await sleep(200);
  const id = a.snap.retro.cards[0].id;
  a.send({ t: "retroVote", v: 1, cardId: id });
  await sleep(200);
  const card = a.snap.retro.cards[0];
  eq(card.votes, 1, "vote counted");
  eq(card.youVoted, true, "youVoted set");
});

await flow("retro: grouping rolls up votes and size", async (t) => {
  const [a] = t(await room(["Alice"]));
  a.send({ t: "switchActivity", v: 1, activity: "retro" });
  await sleep(150);
  a.send({ t: "retroAddCard", v: 1, column: COL, text: "one" });
  await sleep(120);
  a.send({ t: "retroAddCard", v: 1, column: COL, text: "two" });
  await sleep(150);
  a.send({ t: "retroSetPhase", v: 1, phase: "group" });
  await sleep(200);
  const cards = a.snap.retro.cards;
  const c1 = cards.find((c) => c.text === "one"), c2 = cards.find((c) => c.text === "two");
  a.send({ t: "retroGroupCard", v: 1, cardId: c2.id, ontoCardId: c1.id });
  await sleep(250);
  const grouped = a.snap.retro.cards.filter((c) => c.groupId);
  assert(grouped.length === 2 && grouped.every((c) => c.groupSize === 2), "both cards now in a group of 2");
});

await flow("retro: action item with owner", async (t) => {
  const [a] = t(await room(["Alice"]));
  a.send({ t: "switchActivity", v: 1, activity: "retro" });
  await sleep(150);
  a.send({ t: "retroAddCard", v: 1, column: COL, text: "do the thing" });
  await sleep(200);
  a.send({ t: "retroSetPhase", v: 1, phase: "discuss" });
  await sleep(150);
  const id = a.snap.retro.cards[0].id;
  a.send({ t: "retroSetAction", v: 1, cardId: id, on: true, owner: "Alice" });
  await sleep(200);
  const card = a.snap.retro.cards[0];
  eq(card.action, true, "marked as action");
  eq(card.owner, "Alice", "owner set");
});

await flow("retro: delete card", async (t) => {
  const [a] = t(await room(["Alice"]));
  a.send({ t: "switchActivity", v: 1, activity: "retro" });
  await sleep(150);
  a.send({ t: "retroAddCard", v: 1, column: COL, text: "temp" });
  await sleep(200);
  const id = a.snap.retro.cards[0].id;
  a.send({ t: "retroDeleteCard", v: 1, cardId: id });
  await sleep(200);
  eq(a.snap.retro.cards.length, 0, "card removed");
});

await flow("retro: anonymous stays anonymous in every phase, including discuss", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "switchActivity", v: 1, activity: "retro" });
  await sleep(150);
  a.send({ t: "retroSetAnonymous", v: 1, on: true });
  await sleep(120);
  b.send({ t: "retroAddCard", v: 1, column: COL, text: "anon note" });
  await sleep(150);
  a.send({ t: "retroSetPhase", v: 1, phase: "vote" });
  await sleep(200);
  let card = a.snap.retro.cards.find((c) => c.text === "anon note");
  eq(card.author, null, "author hidden while anonymous (vote phase)");
  a.send({ t: "retroSetPhase", v: 1, phase: "discuss" });
  await sleep(200);
  card = a.snap.retro.cards.find((c) => c.text === "anon note");
  eq(card.author, null, "author stays hidden in discuss (badge says Anonymous, so it must mean it)");
});

await flow("estimate: changing the story after a reveal resets the round", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "vote", v: 1, card: "5" });
  b.send({ t: "vote", v: 1, card: "5" });
  await sleep(300); // auto-revealed
  eq(a.est.phase, "revealed", "revealed");
  a.send({ t: "setStory", v: 1, story: "A different story" });
  await sleep(250);
  eq(a.est.story, "A different story", "story changed");
  eq(a.est.phase, "voting", "fresh round");
  eq(a.est.yourVote, null, "old votes cleared under the new story");
});

// ============================ ROADMAP (board) ============================
await flow("roadmap: board cards are independent from retro and never masked", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "switchActivity", v: 1, activity: "board" });
  await sleep(200);
  b.send({ t: "retroAddCard", v: 1, column: "now", text: "Now: ship it" });
  await sleep(250);
  const onA = a.snap.board.cards.find((c) => c.text === "Now: ship it");
  assert(onA && !onA.masked, "board card visible immediately (no blind phase)");
  eq(a.snap.retro.cards.length, 0, "retro canvas untouched by board cards");
});

// ============================ PULSE ============================
await flow("pulse: votes blind until reveal, then aggregates", async (t) => {
  const [a, b, c] = t(await room(["Alice", "Bob", "Cara"]));
  a.send({ t: "switchActivity", v: 1, activity: "pulse" });
  await sleep(200);
  const dims = a.snap.pulse.dimensions;
  for (const d of dims) a.send({ t: "pulseVote", v: 1, dim: d, value: 4 });
  for (const d of dims) b.send({ t: "pulseVote", v: 1, dim: d, value: 2 });
  for (const d of dims) c.send({ t: "pulseVote", v: 1, dim: d, value: 3 });
  await sleep(350);
  eq(b.snap.pulse.results, null, "no results object before reveal");
  assert(a.snap.pulse.voted.length === 3, "all three counted as voted");
  a.send({ t: "pulseReveal", v: 1 });
  await sleep(250);
  eq(a.snap.pulse.phase, "revealed", "revealed");
  const morale = a.snap.pulse.results.find((r) => r.dim === dims[0]);
  eq(morale.avg, 3, "avg of 4, 2, 3 is 3");
});

await flow("pulse: a single voter can't reveal (would de-anonymize)", async (t) => {
  const [a] = t(await room(["Alice"]));
  a.send({ t: "switchActivity", v: 1, activity: "pulse" });
  await sleep(150);
  for (const d of a.snap.pulse.dimensions) a.send({ t: "pulseVote", v: 1, dim: d, value: 4 });
  await sleep(200);
  a.send({ t: "pulseReveal", v: 1 }); // only one submitter, must not reveal
  await sleep(200);
  eq(a.snap.pulse.phase, "voting", "stays hidden with a single submitter");
});

await flow("pulse: reset clears votes and phase", async (t) => {
  const [a, b, c] = t(await room(["Alice", "Bob", "Cara"]));
  a.send({ t: "switchActivity", v: 1, activity: "pulse" });
  await sleep(150);
  for (const x of [a, b, c]) for (const d of a.snap.pulse.dimensions) x.send({ t: "pulseVote", v: 1, dim: d, value: 5 });
  await sleep(250);
  a.send({ t: "pulseReveal", v: 1 });
  await sleep(150);
  eq(a.snap.pulse.phase, "revealed", "revealed with three voters");
  a.send({ t: "pulseReset", v: 1 });
  await sleep(200);
  eq(a.snap.pulse.phase, "voting", "back to voting");
  eq(a.snap.pulse.voted, [], "voters cleared");
});

// ============================ POLL ============================
await flow("poll: open Q&A sorts by votes, vote toggles", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "switchActivity", v: 1, activity: "poll" });
  await sleep(150);
  a.send({ t: "pollSubmit", v: 1, text: "Less meetings" });
  b.send({ t: "pollSubmit", v: 1, text: "More pairing" });
  await sleep(250);
  const more = a.snap.poll.answers.find((x) => x.text === "More pairing");
  a.send({ t: "pollVote", v: 1, id: more.id });
  b.send({ t: "pollVote", v: 1, id: more.id });
  await sleep(250);
  eq(a.snap.poll.answers[0].text, "More pairing", "most-voted answer sorts first");
  eq(a.snap.poll.answers[0].votes, 2, "two votes counted");
  a.send({ t: "pollVote", v: 1, id: more.id }); // toggle off
  await sleep(200);
  eq(a.snap.poll.answers.find((x) => x.text === "More pairing").votes, 1, "vote toggled off");
});

await flow("poll: word-cloud mode aggregates word counts", async (t) => {
  const [a, b, c] = t(await room(["Alice", "Bob", "Cara"]));
  a.send({ t: "switchActivity", v: 1, activity: "poll" });
  await sleep(120);
  a.send({ t: "pollSetMode", v: 1, mode: "cloud" });
  await sleep(150);
  a.send({ t: "pollSubmit", v: 1, text: "focus" });
  b.send({ t: "pollSubmit", v: 1, text: "focus" });
  c.send({ t: "pollSubmit", v: 1, text: "scope" });
  await sleep(300);
  const focus = a.snap.poll.cloud.find((w) => w.word === "focus");
  eq(focus.count, 2, "focus counted twice");
  eq(a.snap.poll.cloud[0].word, "focus", "most frequent word first");
});

await flow("poll: switching mode clears entries", async (t) => {
  const [a] = t(await room(["Alice"]));
  a.send({ t: "switchActivity", v: 1, activity: "poll" });
  await sleep(120);
  a.send({ t: "pollSubmit", v: 1, text: "Q&A item" });
  await sleep(200);
  a.send({ t: "pollSetMode", v: 1, mode: "cloud" });
  await sleep(200);
  eq(a.snap.poll.total, 0, "entries cleared on mode switch");
});

// ============================ PICK ============================
await flow("pick: person spin lands on a present member", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "switchActivity", v: 1, activity: "pick" });
  await sleep(150);
  a.send({ t: "pickSetMode", v: 1, mode: "person" });
  await sleep(150);
  a.send({ t: "pickSpin", v: 1 });
  await sleep(300);
  assert(["Alice", "Bob"].includes(a.snap.pick.result[0]), "picked a real member");
});

await flow("pick: list mode picks one of the options", async (t) => {
  const [a] = t(await room(["Alice"]));
  a.send({ t: "switchActivity", v: 1, activity: "pick" });
  await sleep(120);
  a.send({ t: "pickSetMode", v: 1, mode: "list" });
  await sleep(120);
  for (const it of ["red", "green", "blue"]) a.send({ t: "pickAddItem", v: 1, text: it });
  await sleep(200);
  a.send({ t: "pickSpin", v: 1 });
  await sleep(300);
  assert(["red", "green", "blue"].includes(a.snap.pick.result[0]), "picked one option");
});

// ============================ FACILITATION ============================
await flow("facilitation: first joiner is facilitator, claim is gated while present", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  eq(a.snap.facilitator, a.snap.you, "Alice (first) is facilitator");
  b.send({ t: "claimFacilitator", v: 1 }); // Alice still present, should be refused
  await sleep(250);
  assert(b.snap.facilitator !== b.snap.you, "Bob cannot steal the baton while Alice is here");
});

await flow("facilitation: baton moves when facilitator leaves", async (t) => {
  const cs = t(await room(["Alice", "Bob"]));
  const [a, b] = cs;
  a.close();
  await sleep(400);
  eq(b.snap.facilitator, b.snap.you, "Bob inherits the baton after Alice leaves");
});

await flow("facilitation: end room broadcasts ended to everyone", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "endRoom", v: 1 });
  await sleep(300);
  assert(a.ended && b.ended, "both clients received ended");
});

await flow("facilitation: timer start sets deadline, stop clears it", async (t) => {
  const [a] = t(await room(["Alice"]));
  a.send({ t: "timerStart", v: 1, seconds: 120 });
  await sleep(200);
  assert(a.snap.timerEndsAt && a.snap.timerEndsAt > Date.now(), "timer deadline set");
  a.send({ t: "timerStop", v: 1 });
  await sleep(200);
  eq(a.snap.timerEndsAt, null, "timer cleared");
});

await flow("abuse: two distinct reports end an abusive room", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "reportRoom", v: 1 });
  b.send({ t: "reportRoom", v: 1 });
  await sleep(350);
  assert(a.ended || b.ended, "room ended after meeting the report threshold");
});

// ============================ SPOTLIGHT + EPHEMERAL ============================
await flow("spotlight: facilitator spin broadcasts the same person to everyone", async (t) => {
  const [a, b, c] = t(await room(["Alice", "Bob", "Cara"]));
  a.send({ t: "spotlightPick", v: 1 }); // Alice is the facilitator
  await sleep(300);
  assert(a.spots.length && b.spots.length && c.spots.length, "all three received the spotlight");
  const names = [a.spots.at(-1).name, b.spots.at(-1).name, c.spots.at(-1).name];
  assert(new Set(names).size === 1, "everyone landed on the same name");
  assert(["Alice", "Bob", "Cara"].includes(names[0]), "picked a present member");
});

await flow("spotlight: a non-facilitator spin is ignored", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  b.send({ t: "spotlightPick", v: 1 }); // Bob is not the host
  await sleep(300);
  assert(a.spots.length === 0 && b.spots.length === 0, "no spotlight when a non-host spins");
});

await flow("reactions: an emote fans out to all participants", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "emote", v: 1, emoji: "🎉" });
  await sleep(250);
  assert(a.emotes.length && b.emotes.length, "both saw the emote");
  eq(b.emotes.at(-1).emoji, "🎉", "correct emoji delivered");
});

await flow("cursors: live cursor position fans out to others", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "switchActivity", v: 1, activity: "retro" });
  await sleep(150);
  a.send({ t: "cursor", v: 1, x: 123, y: 45 });
  await sleep(250);
  const mine = b.cursors.find((c) => c.x === 123 && c.y === 45);
  assert(mine, "Bob receives Alice's cursor");
});

await flow("reconnect: same clientId restores the seat and vote", async (t) => {
  const r = newRoom();
  const a = new Client(r, "Alice", `cid-${r}-0`); await a.ready;
  const b = new Client(r, "Bob", `cid-${r}-1`); await b.ready;
  await sleep(250);
  t([a, b]);
  b.send({ t: "vote", v: 1, card: "8" });
  await sleep(250);
  const bId = b.snap.you;
  b.close();
  await sleep(300);
  const b2 = new Client(r, "Bob", `cid-${r}-1`); await b2.ready; // same clientId
  t([b2]);
  await sleep(300);
  eq(b2.snap.you, bId, "same member id restored on reconnect");
  eq(b2.snap.estimate.yourVote, "8", "vote survived the reconnect");
});

// ============================ REDACTION EDGE CASES ============================
await flow("redaction: a rationale never leaks before reveal", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "vote", v: 1, card: "5" }); // 1/2, still voting
  await sleep(150);
  a.send({ t: "setRationale", v: 1, text: "this is a big one" });
  await sleep(250);
  eq(b.est.rationales, null, "Bob sees no rationales while voting is open");
  // after reveal it should surface
  b.send({ t: "vote", v: 1, card: "8" });
  await sleep(300);
  assert(b.est.rationales && Object.values(b.est.rationales).some((r) => r.includes("big one")), "rationale appears after reveal");
});

await flow("redaction: a spectator (no name) gets no raw votes and an empty seat", async (t) => {
  const r = newRoom();
  const a = new Client(r, "Alice", `cid-${r}-0`); await a.ready;
  const spec = new Client(r, "", ""); await spec.ready; // spectator, never sends hello
  await sleep(200);
  t([a, spec]);
  a.send({ t: "vote", v: 1, card: "5" });
  await sleep(250);
  eq(spec.snap.you, "", "spectator has no member id");
  eq(spec.snap.estimate.votes, null, "spectator cannot see raw votes");
});

await flow("estimate: t-shirt (non-numeric) deck still records a consensus", async (t) => {
  const [a, b] = t(await room(["Alice", "Bob"]));
  a.send({ t: "setDeck", v: 1, deck: "tshirt" });
  await sleep(150);
  addStories(a, "Sizing story");
  await sleep(150);
  a.send({ t: "vote", v: 1, card: "M" });
  b.send({ t: "vote", v: 1, card: "M" });
  await sleep(300);
  a.send({ t: "estimateNextStory", v: 1 });
  await sleep(250);
  eq(a.est.log.map((l) => `${l.story}=${l.value}`), ["Sizing story=M"], "non-numeric consensus M logged");
});

// ============================ summary ============================
const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
console.log(`\n${passed}/${results.length} flows passed`);
if (failed.length) {
  console.log(`\n\x1b[31m${failed.length} FAILED:\x1b[0m`);
  failed.forEach((f) => console.log(`  - ${f.name}`));
  process.exit(1);
}
console.log("\x1b[32mAll flows green.\x1b[0m");
process.exit(0);
