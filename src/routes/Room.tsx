import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { createRoomClient, type RoomClient } from "../net/socket";
import { useRoom } from "../store/roomStore";
import { RoomHeader } from "../components/RoomHeader";
import { ActivityTabs } from "../components/ActivityTabs";
import { EstimateBoard } from "../components/EstimateBoard";
import { RetroBoard } from "../components/RetroBoard";
import { PickerBoard } from "../components/PickerBoard";
import { StatusTicker } from "../components/StatusTicker";
import { FLAVOR } from "../lib/flavor";

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
    setConnected,
    setEnded,
    apply,
  } = useRoom();
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const clientRef = useRef<RoomClient | null>(null);

  useEffect(() => () => clientRef.current?.close(), []);

  function join() {
    const trimmed = name.trim();
    if (!trimmed) return;
    clientRef.current = createRoomClient(room, trimmed, apply, setConnected, () => setEnded(true));
    setJoined(true);
  }

  if (ended) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center">
        <div className="max-w-sm">
          <div className="text-4xl" aria-hidden>
            🌙
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">This session has ended</h2>
          <p className="mt-2 text-sm text-slate-500">
            The room expired and was deleted. Nothing was kept — that’s the point.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-500"
          >
            Start a new room
          </a>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <div className="w-full max-w-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Joining room
          </p>
          <h2 className="mb-5 font-mono text-lg text-slate-900">{room}</h2>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="Your name"
            aria-label="Your name"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500"
          />
          <button
            onClick={join}
            className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  if (!estimate || !retro || !pick) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-400">
        <StatusTicker phrases={FLAVOR.connecting} />
      </div>
    );
  }

  const isFacil = !!you && you === facilitator;
  const client = clientRef.current!;

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-3xl">
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
          onClaim={() => client.claimFacilitator()}
        />
        <ActivityTabs
          activity={activity}
          canSwitch={isFacil}
          onSwitch={(a) => client.switchActivity(a)}
        />
        {activity === "estimate" ? (
          <EstimateBoard estimate={estimate} members={members} isFacil={isFacil} client={client} />
        ) : activity === "retro" ? (
          <RetroBoard retro={retro} isFacil={isFacil} client={client} />
        ) : (
          <PickerBoard pick={pick} members={members} isFacil={isFacil} client={client} />
        )}
      </div>
    </div>
  );
}
