import { useState } from "react";
import { useData } from "../data/DataContext";
import type { ShiftOffer } from "../types";
import { conflictMessage, confirmOverlap, findConflicts } from "../utils/conflicts";
import { formatDateShort, formatRange, todayKey } from "../utils/time";
import { ReassignModal } from "./OfferModal";
import { Avatar, ErrorText, WarnText } from "./ui";

export function OfferCard({ offer }: { offer: ShiftOffer }) {
  const {
    me,
    isAdmin,
    shifts,
    shiftById,
    employeeById,
    claimOffer,
    cancelOffer,
  } = useData();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reassign, setReassign] = useState(false);

  const shift = shiftById(offer.shiftId);
  const offerer = employeeById(offer.offeredBy);
  const target = offer.targetEmployeeId
    ? employeeById(offer.targetEmployeeId)
    : undefined;
  const claimer = offer.claimedBy ? employeeById(offer.claimedBy) : undefined;
  if (!shift) return null;

  const isMine = !!me && offer.offeredBy === me.id;
  const canClaim =
    offer.status === "open" &&
    !!me &&
    !isMine &&
    me.positions.includes(shift.position) &&
    (!offer.targetEmployeeId || offer.targetEmployeeId === me.id) &&
    shift.date >= todayKey();
  const canCancel = offer.status === "open" && (isMine || isAdmin);
  const conflicts = findConflicts(shifts, canClaim ? me!.id : null, shift);
  const claim = () => {
    if (!confirmOverlap(conflicts)) return;
    void act(() => claimOffer(offer.id, me!.id));
  };

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const statusChip = {
    open: "bg-emerald-100 text-emerald-800",
    claimed: "bg-blue-100 text-blue-800",
    cancelled: "bg-slate-100 text-slate-500",
  }[offer.status];

  return (
    <div className={`card p-4 ${offer.status !== "open" ? "opacity-75" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {offerer && <Avatar name={offerer.name} color={offerer.color} />}
          <div>
            <div className="text-base sm:text-sm">
              <span className="font-semibold">
                {offerer?.name ?? "Unknown"}
              </span>
              <span className="text-slate-500"> is offering</span>
            </div>
            <div className="text-base font-medium sm:text-sm">
              {formatDateShort(shift.date)} ·{" "}
              {formatRange(shift.startMin, shift.endMin)}
              <span className="ml-1.5 text-sm font-normal text-slate-500 sm:text-xs">
                {shift.position}
              </span>
            </div>
          </div>
        </div>
        <span className={`chip ${statusChip}`}>{offer.status}</span>
      </div>

      <div className="mt-2 text-sm text-slate-500 sm:text-xs">
        {target
          ? `Sent to ${target.name}`
          : `Open to anyone who works ${shift.position}`}
        {offer.status === "claimed" && claimer && (
          <span className="text-blue-700"> · claimed by {claimer.name}</span>
        )}
        {shift.notes && <span> · {shift.notes}</span>}
      </div>
      {offer.message && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-base text-slate-700 sm:text-sm">
          “{offer.message}”
        </p>
      )}

      <WarnText className="mt-2">{conflictMessage(conflicts)}</WarnText>
      {(canClaim || canCancel || isAdmin) && offer.status === "open" && (
        <div className="mt-3 flex flex-wrap gap-2 [&>button]:min-h-11 [&>button]:flex-1 sm:[&>button]:min-h-0 sm:[&>button]:flex-none">
          {canClaim && (
            <button className="btn-primary" disabled={busy} onClick={claim}>
              Claim shift
            </button>
          )}
          {isAdmin && (
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => setReassign(true)}
            >
              Reassign
            </button>
          )}
          {canCancel && (
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => act(() => cancelOffer(offer.id))}
            >
              {isMine ? "Cancel my offer" : "Cancel offer"}
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {reassign && (
        <ReassignModal shift={shift} onClose={() => setReassign(false)} />
      )}
    </div>
  );
}
