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
import { TimerBanner } from "../components/TimerBanner";
import { FormatPicker } from "../components/FormatPicker";
import { RETRO_TEMPLATES, DECK_LABELS } from "../../shared/protocol";
import { retroTheme } from "../lib/retroThemes";
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
    timerDurationMs,
    setConnected,
    setEnded,
    apply,
  } = useRoom();
  const [name, setName] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  // When the facilitator opens Retro on an empty board, surface the format picker
  // so the team starts by choosing a format (the requested "popup on entering retro").
  useEffect(() => {
    const facil = !!you && you === facilitator;
    if (facil && activity === "retro" && retro && retro.cards.length === 0) setPickerOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

  if (ended) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center [background:radial-gradient(50rem_30rem_at_50%_-8rem,var(--color-iris-100),transparent_55%)] dark:[background:radial-gradient(50rem_30rem_at_50%_-8rem,#1b1838,transparent_60%)]">
        <div className="max-w-sm">
          <LogoMark size={48} className="mx-auto opacity-90 grayscale" />
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">This session has ended</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            The room expired and was deleted. Nothing was kept · that’s the point.
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
      <div className="grid min-h-screen place-items-center text-slate-400 [background:radial-gradient(50rem_30rem_at_50%_-8rem,var(--color-iris-100),transparent_55%)] dark:[background:radial-gradient(50rem_30rem_at_50%_-8rem,#1b1838,transparent_60%)]">
        <StatusTicker phrases={FLAVOR.connecting} />
      </div>
    );
  }

  const client = clientRef.current!;
  const joined = !!you; // "" (spectator) is falsy
  const isFacil = joined && you === facilitator;
  const canAct = joined;

  const formatLabel =
    activity === "retro"
      ? (RETRO_TEMPLATES[retro.template]?.label ?? "Retro")
      : activity === "estimate"
        ? (DECK_LABELS[estimate.deck] ?? "Deck")
        : pick.mode === "person"
          ? "Pick a person"
          : pick.mode === "order"
            ? "Shuffle order"
            : "Pick from list";
  const formatIcon =
    activity === "retro" ? retroTheme(retro.template).motif : activity === "estimate" ? "🃏" : "🎲";

  return (
    <div className="flex min-h-screen flex-col [background:radial-gradient(54rem_32rem_at_50%_-10rem,var(--color-iris-100),transparent_55%)] dark:[background:radial-gradient(54rem_32rem_at_50%_-10rem,#1b1838,transparent_60%)]">
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

        <TimerBanner
          endsAt={timerEndsAt}
          durationMs={timerDurationMs}
          isFacil={isFacil}
          onStop={() => client.timerStop()}
        />

        {!joined && (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-iris-200 bg-iris-50 px-4 py-3 dark:border-iris-500/25 dark:bg-iris-500/10">
            <span className="text-sm font-medium text-iris-900 dark:text-iris-200">
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
                className="w-36 rounded-lg border border-iris-200 bg-white px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-iris-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
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

        <div className="flex flex-wrap items-center gap-3">
          <ActivityTabs
            activity={activity}
            canSwitch={isFacil}
            onSwitch={(a) => client.switchActivity(a)}
          />
          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-iris-300 hover:text-iris-600 dark:border-white/10 dark:text-slate-300 dark:hover:text-iris-300"
            title="Browse formats with previews"
          >
            <span aria-hidden>{formatIcon}</span>
            {formatLabel}
            <span className="text-slate-400">▾</span>
          </button>
        </div>
        <p className="mt-2 mb-5 text-xs text-slate-500 dark:text-slate-400">
          One link runs your whole ceremony:{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">Estimate</span>,{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">Retro</span>, and{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">Pick</span> in the same
          room; the facilitator switches and everyone follows.
        </p>

        <div id="ephem-board">
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
        </div>

        {showExport && (
          <ExportSheet
            room={room}
            markdown={buildSessionMarkdown({ room, members, estimate, retro, pick })}
            onClose={() => setShowExport(false)}
          />
        )}

        {pickerOpen && (
          <FormatPicker
            activity={activity}
            retroTemplate={retro.template}
            deck={estimate.deck}
            pickMode={pick.mode}
            isFacil={isFacil}
            client={client}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </main>
      <footer className="border-t border-slate-200/70 bg-white/40 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-500">
        Nothing is stored · the room is deleted when everyone leaves.
      </footer>
    </div>
  );
}
