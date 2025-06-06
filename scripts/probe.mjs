// Deterministic two-client probe of the room server — no browser, no tab throttling.
// Node 25 has a global WebSocket.
const ROOM = "probe-" + process.argv[2];
const URL = `ws://localhost:8787/ws?room=${ROOM}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mkClient(name) {
  const ws = new WebSocket(URL);
  const s = { name, ws, last: null };
  ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hello", v: 1, name })));
  ws.addEventListener("message", (e) => (s.last = JSON.parse(e.data)));
  return s;
}
const log = (s) => {
  const m = s.last;
  console.log(
    `  ${s.name}: facil=${m?.facilitator?.slice(0, 4) ?? "?"} you=${m?.you?.slice(0, 4) ?? "?"} members=[${m?.members.map((x) => x.name).join(",")}] voted=[${m?.estimate.voted.map((i) => i.slice(0, 4)).join(",")}] votes=${JSON.stringify(m?.estimate.votes)}`,
  );
};

const a = mkClient("Alice");
await sleep(400);
console.log("== after Alice joins =="); log(a);

const b = mkClient("Bob");
await sleep(400);
console.log("== after Bob joins =="); log(a); log(b);

b.ws.send(JSON.stringify({ t: "vote", v: 1, card: "13" }));
await sleep(300);
console.log("== after Bob votes 13 =="); log(a); log(b);

a.ws.send(JSON.stringify({ t: "vote", v: 1, card: "3" }));
await sleep(300);
console.log("== after Alice votes 3 =="); log(a); log(b);

a.ws.send(JSON.stringify({ t: "reveal", v: 1 }));
await sleep(300);
console.log("== after Alice reveals =="); log(a); log(b);

process.exit(0);
