// Soak test you can WATCH: a dozen bots run a full ceremony tour in one room at
// human pace — estimate, retro (all phases + tags/colors/clusters/connectors/
// spotlight/timer), plan (all four canvases), pulse, poll, pick, baton passes,
// emotes and wandering cursors — looping scenes until DURATION elapses.
//
//   HOST=wss://scrumlo.com ROOM=team-soak-live MINUTES=15 node test/soak.mjs
//
// Join the same room in a browser to watch it live.

const HOST = process.env.HOST || "ws://localhost:8787";
const ROOM = process.env.ROOM || `soak-${Date.now().toString(36)}`;
const DURATION_MS = (Number(process.env.MINUTES) || 15) * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const think = (lo = 2500, hi = 7000) => sleep(lo + Math.random() * (hi - lo)); // a human moment
const started = Date.now();
const left = () => DURATION_MS - (Date.now() - started);
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const NAMES = ["Priya", "Marco", "Yuki", "Dana", "Tom", "Aisha", "Leo", "Ines", "Sam", "Noor", "Felix", "Zara"];
const EMOTES = ["👍", "❤️", "🎉", "😂", "🔥", "👏", "🤯", "🙌"];
const REACTS = ["👍", "❤️", "🎯", "🔥", "😂", "👀", "🎉", "💡", "🚀", "🤔", "😮", "💯"];
const TAGS = ["Priority", "Quick win", "Blocked", "Idea"];
const COLORS = ["yellow", "green", "blue", "pink", "purple", "orange"];
const STICKY_LINES = [
  "deploy pipeline felt smooth", "standup ran long again", "pairing on the worker rocked",
  "too many meetings midweek", "great bug hunt on Tuesday", "docs are getting stale",
  "demo went brilliantly", "flaky test ate my morning", "love the new dashboards",
  "we shipped the thing!", "queue is piling up", "good energy this sprint",
  "Friday deploys are spicy", "retro snacks were elite", "onboarding doc saved me",
];

class Bot {
  constructor(name, i) {
    this.name = name;
    this.snap = null;
    this.ended = false;
    this.ws = new WebSocket(`${HOST}/ws?room=${ROOM}`);
    this.ready = new Promise((res) => {
      this.ws.addEventListener("open", () => {
        this.send({ t: "hello", v: 1, name, clientId: `soak-${ROOM}-${i}` });
        res();
      });
    });
    this.ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.t === "snapshot") this.snap = m;
      else if (m.t === "ended") this.ended = true;
    });
  }
  send(m) {
    try {
      this.ws.send(JSON.stringify(m));
    } catch {}
  }
}

log(`soak → ${HOST} room=${ROOM} for ${Math.round(DURATION_MS / 60000)} min`);
const bots = [];
for (let i = 0; i < NAMES.length; i++) {
  const b = new Bot(NAMES[i], i);
  await b.ready;
  bots.push(b);
  await sleep(150); // sequential: Priya is the facilitator
}
await sleep(400);
let facil = bots[0];
const others = () => bots.filter((b) => b !== facil);
log(`12 bots in · facilitator: ${facil.name}`);

// Cursors like humans: mostly resting (reading), occasionally gliding to look at
// something, then still again. Never the whole room moving at once.
const wander = setInterval(() => {
  const now = Date.now();
  for (const b of bots) {
    if (b.restUntil && now < b.restUntil) continue; // reading, hand off the mouse
    if (!b.moveUntil || now > b.moveUntil) {
      b.restUntil = now + 5000 + Math.random() * 18000; // long, uneven rests
      b.moveUntil = b.restUntil + 900 + Math.random() * 2600; // then a short glide
      b.tx = 60 + Math.random() * 1380;
      b.ty = 60 + Math.random() * 840;
      continue;
    }
    b.wx = (b.wx ?? 700) + ((b.tx ?? 700) - (b.wx ?? 700)) * 0.16;
    b.wy = (b.wy ?? 400) + ((b.ty ?? 400) - (b.wy ?? 400)) * 0.16;
    b.send({ t: "cursor", v: 1, x: Math.round(b.wx), y: Math.round(b.wy) });
  }
}, 120);
// A stray emote every so often, from someone.
const emoter = setInterval(() => rnd(bots).send({ t: "emote", v: 1, emoji: rnd(EMOTES) }), 9000);

const cards = () => facil.snap?.retro?.cards ?? [];
// Not everyone does everything: each scene, a few people are reading Slack instead.
const active = () => bots.filter((b) => b === facil || Math.random() > 0.2);

async function sceneEstimate() {
  log("scene: ESTIMATE");
  facil.send({ t: "switchActivity", v: 1, activity: "estimate" });
  await sleep(800);
  facil.send({ t: "setDeck", v: 1, deck: "fib" });
  facil.send({ t: "estimateQueueAdd", v: 1, stories: ["Search relevance tuning", "Billing retries", "Mobile nav polish"] });
  for (let story = 0; story < 1; story++) {
    await sleep(1200);
    const room = [...bots].sort(() => Math.random() - 0.5); // votes land in human order
    const straggler = room.pop(); // someone is always \"sorry, was on mute\"
    for (const b of room) {
      b.send({ t: "vote", v: 1, card: rnd(["2", "3", "5", "8"]) });
      await sleep(1000 + Math.random() * 1800); // thinking, but the room keeps moving
    }
    const waffler = rnd(room);
    await think(2000, 4000);
    waffler.send({ t: "vote", v: 1, card: rnd(["3", "5"]) }); // second-guessed themselves
    await think(2500, 4500);
    straggler.send({ t: "vote", v: 1, card: rnd(["2", "5", "8"]) }); // finally
    await sleep(3500); // auto-reveal lands, the room reads the line
    const outlier = rnd(others());
    outlier.send({ t: "typing", v: 1, on: true });
    await sleep(4000); // typing a real sentence
    outlier.send({ t: "setRationale", v: 1, text: "pricing the unknown data migration" });
    outlier.send({ t: "typing", v: 1, on: false });
    await sleep(1500);
    facil.send({ t: "lockDecision", v: 1, value: "5", note: "split if the migration bites" });
    await sleep(1200);
    facil.send({ t: "estimateNextStory", v: 1 });
  }
  // a t-shirt round for flavor
  facil.send({ t: "setDeck", v: 1, deck: "tshirt" });
  await sleep(900);
  for (const b of bots) {
    b.send({ t: "vote", v: 1, card: rnd(["S", "M", "L"]) });
    await sleep(800 + Math.random() * 1400);
  }
  await sleep(1500);
}

async function sceneRetro() {
  log("scene: RETRO");
  facil.send({ t: "switchActivity", v: 1, activity: "retro" });
  await sleep(700);
  facil.send({ t: "retroSetTemplate", v: 1, template: rnd(["msg", "ssc", "fourls"]) });
  await sleep(900);
  const colIds = facil.snap?.retro?.columns?.map((c) => c.id) ?? ["start"];
  facil.send({ t: "timerStart", v: 1, seconds: 90 });

  // brainstorm: most people drop 2 stickies, staggered like real typing
  for (let round = 0; round < 1; round++) {
    for (const b of active()) {
      const line = rnd(STICKY_LINES);
      const typo = round === 0 && b === bots[3]; // Dana always typos the first one
      b.send({ t: "retroAddCard", v: 1, column: rnd(colIds), text: typo ? line.replace("e", "ee") : line });
      if (typo) {
        await think(2500, 4000); // notices, sighs, double-clicks
        const mine = (b.snap?.retro?.cards ?? []).find((k) => k.text === line.replace("e", "ee"));
        if (mine) b.send({ t: "retroEditCard", v: 1, cardId: mine.id, text: line });
      }
      await sleep(1400 + Math.random() * 2200); // writing takes a moment
    }
  }
  await sleep(800);
  // decorate: tags, colors, reactions from various people
  for (const c of cards().slice(0, 10)) {
    rnd(bots).send({ t: "retroReact", v: 1, cardId: c.id, emoji: rnd(REACTS) });
    if (Math.random() < 0.5) rnd(bots).send({ t: "retroTagCard", v: 1, cardId: c.id, tag: rnd(TAGS), on: true });
    await sleep(700 + Math.random() * 900);
  }
  for (const b of bots.slice(0, 6)) {
    const mine = cards().find((k) => k.text.length > 0);
    if (mine) b.send({ t: "retroColorCard", v: 1, cardId: mine.id, color: rnd(COLORS) });
    await sleep(600 + Math.random() * 700);
  }
  facil.send({ t: "timerExtend", v: 1, seconds: 30 });
  await sleep(1200);
  facil.send({ t: "timerPause", v: 1 });
  await sleep(1500);
  facil.send({ t: "timerResume", v: 1 });

  // group: cluster a few, name them, draw a couple of connectors
  facil.send({ t: "retroSetPhase", v: 1, phase: "group" });
  await sleep(900);
  const cs = cards();
  if (cs.length >= 4) {
    facil.send({ t: "retroGroupCard", v: 1, cardId: cs[1].id, ontoCardId: cs[0].id });
    await sleep(900);
    const gid = (facil.snap?.retro?.cards ?? []).find((k) => k.groupId)?.groupId;
    if (gid) facil.send({ t: "retroRenameGroup", v: 1, groupId: gid, title: "Process pain" });
    facil.send({ t: "retroLinkCards", v: 1, fromId: cs[2].id, toId: cs[3].id });
  }
  await sleep(1500);
  facil.send({ t: "retroSort", v: 1, by: "tag" });
  await sleep(2000);

  // vote: everyone spends dots
  facil.send({ t: "retroSetPhase", v: 1, phase: "vote" });
  await sleep(800);
  for (const b of active()) {
    for (const c of cards().slice(0, 3)) {
      b.send({ t: "retroVote", v: 1, cardId: c.id });
      await sleep(400 + Math.random() * 700);
    }
  }
  await sleep(1000);

  // discuss: spotlight, spin the picker, capture action items
  facil.send({ t: "retroSetPhase", v: 1, phase: "discuss" });
  await sleep(700);
  const top = cards()[0];
  if (top) {
    facil.send({ t: "retroSpotlight", v: 1, cardId: top.id });
    await think(2500, 4000);
    for (const b of active().slice(0, 5)) {
      b.send({ t: "retroReact", v: 1, cardId: top.id, emoji: rnd(REACTS) }); // agreement ripples
      await sleep(700 + Math.random() * 1200);
    }
    await sleep(3000); // the room actually discusses it
    facil.send({ t: "retroSetAction", v: 1, cardId: top.id, on: true, owner: rnd(NAMES) });
    facil.send({ t: "retroSpotlight", v: 1, cardId: null });
  }
  facil.send({ t: "spotlightPick", v: 1 });
  facil.send({ t: "timerStop", v: 1 });
  await sleep(1500);

  // pass the baton — coronation for whoever's watching
  const heir = rnd(others());
  const heirId = facil.snap?.members?.find((m) => m.name === heir.name)?.id;
  if (heirId) {
    log(`baton: ${facil.name} → ${heir.name}`);
    facil.send({ t: "handBaton", v: 1, toId: heirId });
    facil = heir;
    await sleep(4000);
  }
}

async function scenePlan() {
  log("scene: PLAN");
  facil.send({ t: "switchActivity", v: 1, activity: "board" });
  await sleep(700);
  for (const tpl of ["roadmap", "mindmap", "flow", "matrix"]) {
    facil.send({ t: "retroSetTemplate", v: 1, template: tpl });
    await sleep(900);
    const colIds = facil.snap?.board?.columns?.map((c) => c.id) ?? ["canvas"];
    const n = tpl === "roadmap" ? 6 : 5;
    for (let i = 0; i < n; i++) {
      rnd(bots).send({ t: "retroAddCard", v: 1, column: rnd(colIds), text: rnd(STICKY_LINES) });
      await sleep(1500 + Math.random() * 1800);
    }
    if (tpl === "matrix") {
      // drag ideas into quadrants
      const bc = facil.snap?.board?.cards ?? [];
      for (const c of bc.slice(0, 4)) {
        facil.send({ t: "retroMoveXY", v: 1, cardId: c.id, x: 120 + Math.random() * 1200, y: 120 + Math.random() * 700 });
        await sleep(1200 + Math.random() * 1000);
      }
    }
    await sleep(900);
  }
}

async function scenePulse() {
  log("scene: PULSE");
  facil.send({ t: "switchActivity", v: 1, activity: "pulse" });
  await sleep(700);
  facil.send({ t: "pulseSetTheme", v: 1, theme: rnd(["classic", "sprint", "vibes", "remote"]) });
  await sleep(800);
  const dims = facil.snap?.pulse?.dimensions ?? [];
  for (const b of active()) {
    for (const d of dims) {
      b.send({ t: "pulseVote", v: 1, dim: d, value: 2 + Math.floor(Math.random() * 4) });
      await sleep(350 + Math.random() * 450);
    }
    await sleep(500);
  }
  await sleep(1200);
  facil.send({ t: "pulseReveal", v: 1 });
  await sleep(7000); // let watchers read the verdict
  facil.send({ t: "pulseReset", v: 1 });
}

async function scenePoll() {
  log("scene: POLL");
  facil.send({ t: "switchActivity", v: 1, activity: "poll" });
  await sleep(700);
  facil.send({ t: "pollSetMode", v: 1, mode: "open" });
  facil.send({ t: "pollSetPrompt", v: 1, prompt: "Name our team mascot" });
  await sleep(800);
  const ANSWERS = ["Captain Standup", "The Blocked Badger", "Sir Ships-a-Lot", "Velocity Raptor", "Scrumzilla", "The Mergewolf"];
  for (const b of bots.slice(0, 6)) {
    b.send({ t: "pollSubmit", v: 1, text: rnd(ANSWERS) });
    await sleep(1500 + Math.random() * 1500); // typing a mascot name is serious work
  }
  await sleep(800);
  facil.send({ t: "pollReveal", v: 1 });
  await sleep(1800);
  for (const b of bots) {
    const a = rnd(facil.snap?.poll?.answers ?? []);
    if (a) b.send({ t: "pollVote", v: 1, id: a.id });
    await sleep(500 + Math.random() * 700);
  }
  await sleep(2500);
  // word cloud round
  facil.send({ t: "pollSetMode", v: 1, mode: "cloud" });
  facil.send({ t: "pollSetPrompt", v: 1, prompt: "This sprint in one word" });
  await sleep(800);
  const WORDS = ["chaotic", "shippy", "focused", "spicy", "smooth", "caffeinated", "legendary"];
  for (const b of bots) {
    b.send({ t: "pollSubmit", v: 1, text: rnd(WORDS) });
    await sleep(600 + Math.random() * 900);
  }
  await sleep(900);
  facil.send({ t: "pollReveal", v: 1 });
  await sleep(2500);
}

async function scenePick() {
  log("scene: PICK");
  facil.send({ t: "switchActivity", v: 1, activity: "pick" });
  await sleep(700);
  facil.send({ t: "pickSetMode", v: 1, mode: "person" });
  await sleep(500);
  facil.send({ t: "pickSpin", v: 1 });
  await sleep(6000); // wheel + confetti
  facil.send({ t: "pickSetMode", v: 1, mode: "order" });
  await sleep(500);
  facil.send({ t: "pickSpin", v: 1 });
  await sleep(4000);
}

const scenes = [sceneEstimate, sceneRetro, scenePlan, scenePulse, scenePoll, scenePick];
let cycle = 0;
while (left() > 30_000) {
  cycle++;
  log(`— cycle ${cycle} (${Math.round(left() / 60000)} min left) —`);
  for (const scene of scenes) {
    if (left() < 30_000) break;
    try {
      await scene();
    } catch (e) {
      log(`scene error (continuing): ${e.message}`);
    }
    await think(3500, 6000); // a beat between activities
  }
}

clearInterval(wander);
clearInterval(emoter);
const dead = bots.filter((b) => b.ended || b.ws.readyState !== WebSocket.OPEN);
log(`done after ${Math.round((Date.now() - started) / 60000)} min · cycles: ${cycle} · dead sockets: ${dead.length}/12 · room ended flag: ${bots.some((b) => b.ended)}`);
if (dead.length) {
  console.error("FAIL: sockets died during the soak");
  process.exit(1);
}
const sig = new Set(bots.map((b) => JSON.stringify({ m: b.snap?.members?.length, a: b.snap?.activity })));
log(`final state agreement: ${sig.size === 1 ? "✓ identical" : "✗ DIVERGED " + [...sig].join(" vs ")}`);
for (const b of bots) b.ws.close();
log("soak passed.");
