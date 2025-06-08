import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { createRoomClient, type RoomClient } from "../net/socket";
import { useRoom } from "../store/roomStore";
import { RoomHeader } from "../components/RoomHeader";
import { ActivityTabs } from "../components/ActivityTabs";
import { EstimateBoard } from "../components/EstimateBoard";
import { RetroBoard } from "../components/RetroBoard";
import { PickerBoard } from "../components/PickerBoard";
import { ExportSheet } from "../components/ExportSheet";
import { StatusTicker } from "../components/StatusTicker";
import { LogoMark } from "../components/Logo";
import { FLAVOR } from "../lib/flavor";
import { buildSessionMarkdown } from "../lib/exportMarkdown";

export default function Room() {
  const params = useParams<{ room: string }>();
  const room = params.room;
  const {
    connected,
    ended,
    you,
    facilitator,
    members,
    activity,
    estimate,
    retro,
    pick,
    timerEndsAt,
    setConnected,
    setEnded,
    apply,
  } = useRoom();
  const [name, setName] = useState("");
  const [showExport, setShowExport] = useState(false);
  const clientRef = useRef<RoomClient | null>(null);

  // Render-first: connect as a spectator on mount; the user names themselves
  // (becomes a participant) only when they want to act.
  useEffect(() => {
    const client = createRoomClient(room, apply, setConnected, () => setEnded(true));
    clientRef.current = client;
    return () => client.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  function join() {
    const trimmed = name.trim();
    if (!trimmed) return;
    clientRef.current?.join(trimmed);
  }

  if (ended) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center [background:radial-gradient(50rem_30rem_at_50%_-8rem,var(--color-iris-100),transparent_55%)]">
        <div className="max-w-sm">
          <LogoMark size={48} className="mx-auto opacity-90 grayscale" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">This session has ended</h2>
          <p className="mt-2 text-sm text-slate-500">
            The room expired and was deleted. Nothing was kept — that’s the point.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-xl bg-iris-600 px-5 py-2.5 font-semibold text-white shadow-soft transition hover:bg-iris-500"
          >
            Start a new room
          </a>
        </div>
      </div>
    );
  }

  if (!estimate || !retro || !pick) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400 [background:radial-gradient(50rem_30rem_at_50%_-8rem,var(--color-iris-100),transparent_55%)]">
        <StatusTicker phrases={FLAVOR.connecting} />
      </div>
    );
  }

  const client = clientRef.current!;
  const joined = !!you; // "" (spectator) is falsy
  const isFacil = joined && you === facilitator;
  const canAct = joined;

  return (
    <div className="flex min-h-screen flex-col [background:radial-gradient(54rem_32rem_at_50%_-10rem,var(--color-iris-100),transparent_55%)]">
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {!connected && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            <StatusTicker phrases={FLAVOR.reconnecting} />
          </div>
        )}

        <RoomHeader
          room={room}
          connected={connected}
          members={members}
          facilitator={facilitator}
          you={you}
          timerEndsAt={timerEndsAt}
          onClaim={() => client.claimFacilitator()}
          onExport={() => setShowExport(true)}
          onTimerStart={(s) => client.timerStart(s)}
          onTimerStop={() => client.timerStop()}
          onEnd={() => client.endRoom()}
          onReport={() => client.reportRoom()}
        />

        {!joined && (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-iris-200 bg-iris-50 px-4 py-3">
            <span className="text-sm font-medium text-iris-900">
              You’re watching. Add your name to vote or add cards.
            </span>
            <div className="ml-auto flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="your name"
                aria-label="Your name"
                className="w-36 rounded-lg border border-iris-200 bg-white px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-iris-500"
              />
              <button
                onClick={join}
                className="rounded-lg bg-iris-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-iris-500"
              >
                Join
              </button>
            </div>
          </div>
        )}

        <ActivityTabs
          activity={activity}
          canSwitch={isFacil}
          onSwitch={(a) => client.switchActivity(a)}
        />
        <p className="-mt-2 mb-5 text-xs text-slate-500">
          One link runs your whole ceremony —{" "}
          <span className="font-semibold text-slate-700">Estimate</span>,{" "}
          <span className="font-semibold text-slate-700">Retro</span>, and{" "}
          <span className="font-semibold text-slate-700">Pick</span> in the same room; the
          facilitator switches and everyone follows.
        </p>

        {activity === "estimate" ? (
          <EstimateBoard
            estimate={estimate}
            members={members}
            you={you ?? ""}
            isFacil={isFacil}
            canAct={canAct}
            client={client}
          />
        ) : activity === "retro" ? (
          <RetroBoard retro={retro} isFacil={isFacil} canAct={canAct} client={client} />
        ) : (
          <PickerBoard pick={pick} members={members} isFacil={isFacil} client={client} />
        )}

        {showExport && (
          <ExportSheet
            room={room}
            markdown={buildSessionMarkdown({ room, members, estimate, retro, pick })}
            onClose={() => setShowExport(false)}
          />
        )}
      </main>
      <footer className="border-t border-slate-200/70 bg-white/40 py-4 text-center text-xs text-slate-500">
        Nothing is stored — the room is deleted when everyone leaves.
      </footer>
    </div>
  );
}
