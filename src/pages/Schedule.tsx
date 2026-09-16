import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { CopyWeekModal, type CopyResult } from "../components/CopyWeekModal";
import { ShiftRow } from "../components/ShiftCard";
import { ShiftDetailModal } from "../components/ShiftDetailModal";
import { ShiftModal, type ShiftDraft } from "../components/ShiftModal";
import {
  addMonths,
  formatMonth,
  MonthGrid,
  monthKey,
  monthRange,
} from "../components/MonthGrid";
import { DayPartToggle, useDayCellState } from "../components/DayCell";
import { DayList } from "../components/DayList";
import { formatWeek, WeekFeed } from "../components/WeekFeed";
import { TimelineGrid } from "../components/TimelineGrid";
import { EmptyState, PageHeader } from "../components/ui";
import { useData } from "../data/DataContext";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { POSITIONS, type Position, type Shift } from "../types";
import { confirmOverlap, findConflicts } from "../utils/conflicts";
import {
  addDays,
  dateRange,
  formatDateLong,
  formatDateShort,
  fromDateKey,
  startOfWeek,
  todayKey,
} from "../utils/time";

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`chip border py-1 transition ${
        active
          ? "border-transparent text-white"
          : color
            ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
      style={active ? { backgroundColor: color ?? "#0f172a" } : undefined}
    >
      {color && !active && (
        <span
          className="mr-1.5 h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </button>
  );
}

/** Staff filter chips tucked behind one "Staff" chip; opens a popover of color-coded, multi-select chips. */
function StaffPicker({
  employees,
  selected,
  onToggle,
  onClear,
}: {
  employees: { id: string; name: string; color: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const picked = employees.filter((e) => selected.has(e.id));
  return (
    <div ref={root} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`chip border py-1 transition ${
          picked.length
            ? "border-transparent bg-slate-900 text-white"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {picked.length ? (
          <>
            <span className="mr-1.5 flex -space-x-1">
              {picked.slice(0, 4).map((e) => (
                <span
                  key={e.id}
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-slate-900"
                  style={{ backgroundColor: e.color }}
                />
              ))}
            </span>
            {picked.length === 1
              ? picked[0].name.split(" ")[0]
              : `${picked.length} staff`}
          </>
        ) : (
          "Staff"
        )}
        <ChevronDown size={12} className="ml-1" />
      </button>
      {open && (
        <div
          role="group"
          aria-label="Filter by staff"
          className="absolute left-0 top-full z-30 mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg sm:w-96"
        >
          {employees.map((e) => (
            <FilterChip
              key={e.id}
              active={selected.has(e.id)}
              color={e.color}
              onClick={() => onToggle(e.id)}
            >
              {e.name.split(" ")[0]}
            </FilterChip>
          ))}
          {picked.length > 0 && (
            <button
              className="chip w-full justify-center text-slate-500 hover:text-slate-800"
              onClick={onClear}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const VIEW_KEY = "shift-manager:schedule:view";
const LAYOUT_KEY = "shift-manager:schedule:layout";
type View = "month" | "week" | "days";

export function Schedule() {
  const {
    shifts,
    employees,
    offers,
    isAdmin,
    me,
    employeeById,
    createShift,
    updateShift,
    createShifts,
    deleteShifts,
  } = useData();
  const isDesktop = useIsDesktop();
  // Managers build the schedule in the month grid, so it's their default (last choice remembered).
  // Month and Week snap to Sunday; Days is a 1–7 day run starting today.
  const [view, setViewState] = useState<View>(() => {
    if (!isAdmin) return "days";
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === "week" || saved === "days" ? saved : "month";
  });
  const setView = (v: View) => {
    setViewState(v);
    if (isAdmin) localStorage.setItem(VIEW_KEY, v);
  };
  const [dayCount, setDayCount] = useState(1);
  const [start, setStart] = useState(() =>
    view === "days" ? todayKey() : startOfWeek(todayKey()),
  );
  const days = view === "week" ? 7 : dayCount;
  // Desktop multi-day: time axis or condensed chip columns.
  const [layout, setLayoutState] = useState<"timeline" | "list">(() =>
    localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "timeline",
  );
  const setLayout = (l: "timeline" | "list") => {
    setLayoutState(l);
    localStorage.setItem(LAYOUT_KEY, l);
  };
  const isMonth = view === "month";
  // Desktop week list is a continuous feed of weeks, like the month grid.
  const isWeekFeed = isDesktop && view === "week" && layout === "list";
  const [weeks, setWeeks] = useState<string[]>(() => {
    const w = startOfWeek(todayKey());
    return [addDays(w, -7), w, addDays(w, 7), addDays(w, 14)];
  });
  const [visibleWeek, setVisibleWeek] = useState(() => startOfWeek(todayKey()));
  const [weekScrollTarget, setWeekScrollTarget] = useState<{
    week: string;
    key: number;
  } | null>(() => ({
    week: startOfWeek(todayKey()),
    key: 0,
  }));
  const needWeekBefore = useCallback(
    () => setWeeks((ws) => [addDays(ws[0], -7), ...ws]),
    [],
  );
  const needWeekAfter = useCallback(
    () => setWeeks((ws) => [...ws, addDays(ws[ws.length - 1], 7)]),
    [],
  );
  const jumpToWeek = (w: string) => {
    setWeeks((ws) => {
      let next = ws;
      while (w < next[0]) next = [addDays(next[0], -7), ...next];
      while (w > next[next.length - 1])
        next = [...next, addDays(next[next.length - 1], 7)];
      return next;
    });
    setWeekScrollTarget((t) => ({ week: w, key: (t?.key ?? 0) + 1 }));
  };
  // Keep `start` in step with the week in view so switching views lands nearby.
  useEffect(() => {
    if (isWeekFeed) setStart(visibleWeek);
  }, [isWeekFeed, visibleWeek]);
  const [months, setMonths] = useState<string[]>(() => {
    const m = monthKey(todayKey());
    return [m, addMonths(m, 1)];
  });
  const [visibleMonth, setVisibleMonth] = useState(() => monthKey(todayKey()));
  const [scrollTarget, setScrollTarget] = useState<{
    month: string;
    key: number;
  } | null>(null);
  const needBefore = useCallback(
    () => setMonths((ms) => [addMonths(ms[0], -1), ...ms]),
    [],
  );
  const needAfter = useCallback(
    () => setMonths((ms) => [...ms, addMonths(ms[ms.length - 1], 1)]),
    [],
  );
  const jumpToMonth = (m: string) => {
    setMonths((ms) => {
      let next = ms;
      while (m < next[0]) next = [addMonths(next[0], -1), ...next];
      while (m > next[next.length - 1])
        next = [...next, addMonths(next[next.length - 1], 1)];
      return next;
    });
    setScrollTarget((t) => ({ month: m, key: (t?.key ?? 0) + 1 }));
  };
  const [positionFilter, setPositionFilter] = useState<Set<Position>>(
    () => new Set(),
  );
  const togglePosition = (p: Position) =>
    setPositionFilter((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  /** Default position for new shifts: the single selected chip, else Server. */
  const position: Position | "" =
    positionFilter.size === 1 ? [...positionFilter][0] : "";
  const [employeeFilter, setEmployeeFilter] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleEmployee = (id: string) =>
    setEmployeeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [detail, setDetail] = useState<Shift | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [lastCopy, setLastCopy] = useState<CopyResult | null>(null);
  const [undoing, setUndoing] = useState(false);

  const finishCopy = (r: CopyResult) => {
    setCopying(null);
    setLastCopy(r);
    if (isMonth) jumpToMonth(monthKey(r.targetStart));
    else if (isWeekFeed) jumpToWeek(r.targetStart);
    else setStart(r.targetStart);
  };
  const moveShift = (s: Shift, date: string, copy: boolean) => {
    if (!confirmOverlap(findConflicts(shifts, s.employeeId, { ...s, date }, s.id), employeeById(s.employeeId)?.name))
      return;
    if (copy) {
      const { id: _id, ...rest } = s;
      void createShift({ ...rest, date });
    } else {
      void updateShift(s.id, { date });
    }
  };
  const undoCopy = async () => {
    if (!lastCopy) return;
    setUndoing(true);
    try {
      await deleteShifts(lastCopy.created.map((s) => s.id));
      if (lastCopy.removed.length)
        await createShifts(
          lastCopy.removed.map(({ id: _id, ...rest }) => rest),
        );
      setLastCopy(null);
    } finally {
      setUndoing(false);
    }
  };

  const range = useMemo(() => {
    if (isWeekFeed) return dateRange(weeks[0], weeks.length * 7);
    if (!isMonth) return dateRange(start, days);
    if (!isDesktop) {
      const { start: s, end } = monthRange(visibleMonth);
      return dateRange(
        s,
        Math.round(
          (fromDateKey(end).getTime() - fromDateKey(s).getTime()) / 86400000,
        ) + 1,
      );
    }
    const s = monthRange(months[0]).start;
    const end = monthRange(months[months.length - 1]).end;
    return dateRange(
      s,
      Math.round(
        (fromDateKey(end).getTime() - fromDateKey(s).getTime()) / 86400000,
      ) + 1,
    );
  }, [
    start,
    days,
    isMonth,
    months,
    isWeekFeed,
    weeks,
    isDesktop,
    visibleMonth,
  ]);
  /** The week/day run the header, Copy week and + Shift act on (feed views scroll, so use the visible one). */
  const focusRange = useMemo(
    () => (isWeekFeed ? dateRange(visibleWeek, 7) : range),
    [isWeekFeed, visibleWeek, range],
  );
  const visible = useMemo(
    () =>
      shifts.filter(
        (s) =>
          range.includes(s.date) &&
          (positionFilter.size === 0 || positionFilter.has(s.position)) &&
          (employeeFilter.size === 0 ||
            (s.employeeId !== null && employeeFilter.has(s.employeeId))),
      ),
    [shifts, range, positionFilter, employeeFilter],
  );
  /** Positions that have a shift in the displayed range (filter chips). */
  const scheduledPositions = useMemo(() => {
    const used = new Set(
      shifts.filter((s) => range.includes(s.date)).map((s) => s.position),
    );
    return POSITIONS.filter((p) => used.has(p) || positionFilter.has(p));
  }, [shifts, range, positionFilter]);
  /** Employees with a shift in the displayed range (admin filter chips). */
  const scheduledEmployees = useMemo(() => {
    const ids = new Set(
      shifts
        .filter(
          (s) =>
            range.includes(s.date) &&
            (positionFilter.size === 0 || positionFilter.has(s.position)),
        )
        .map((s) => s.employeeId),
    );
    return employees
      .filter((e) => e.id !== me?.id && ids.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [shifts, range, positionFilter, employees, me]);
  const offeredShiftIds = useMemo(
    () =>
      new Set(offers.filter((o) => o.status === "open").map((o) => o.shiftId)),
    [offers],
  );

  // Phones show one month at a time (no scrolling grid), so navigation moves `visibleMonth` directly.
  const showMonth = (m: string) =>
    isDesktop ? jumpToMonth(m) : setVisibleMonth(m);
  const step = (dir: 1 | -1) => {
    if (isMonth) showMonth(addMonths(visibleMonth, dir));
    else if (isWeekFeed) jumpToWeek(addDays(visibleWeek, dir * 7));
    else setStart(addDays(start, dir * days));
  };
  // Bumped by Today so the phone list re-scrolls even when the range is already current.
  const [todayNonce, setTodayNonce] = useState(0);
  const goToday = () => {
    if (isMonth) showMonth(monthKey(todayKey()));
    else if (isWeekFeed) jumpToWeek(startOfWeek(todayKey()));
    else setStart(view === "week" ? startOfWeek(todayKey()) : todayKey());
    setTodayNonce((n) => n + 1);
  };

  // Phones: the controls stick under the app header, and a stacked list opens with today (or its first day) at the top.
  const controls = useRef<HTMLDivElement>(null);
  const shiftsLoaded = shifts.length > 0;
  useEffect(() => {
    if (isDesktop) return;
    const target = range.includes(todayKey()) ? todayKey() : range[0];
    const cell = document.querySelector<HTMLElement>(`[data-date="${target}"]`);
    if (!cell || !controls.current) return;
    const header =
      document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    const offset = header + controls.current.offsetHeight + 8;
    window.scrollTo({
      top: cell.getBoundingClientRect().top + window.scrollY - offset,
    });
  }, [isDesktop, range, shiftsLoaded, todayNonce]);
  // Phones: the day whose cell is at the top of the stacked list, shown in the sticky header.
  const [topDay, setTopDay] = useState<string | null>(null);
  const stacked = !isDesktop && (isMonth || days > 1);
  const dayParts = useDayCellState();
  useEffect(() => {
    if (!stacked) {
      setTopDay(null);
      return;
    }
    const update = () => {
      const limit =
        (controls.current?.getBoundingClientRect().bottom ?? 0) + 12;
      let current: string | null = null;
      for (const el of document.querySelectorAll<HTMLElement>("[data-date]")) {
        if (el.getBoundingClientRect().top <= limit)
          current = el.dataset.date ?? null;
        else break;
      }
      setTopDay(current ?? range[0]);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [stacked, range, shiftsLoaded]);

  // Phones: swipe left/right to move to the next/previous day, run or month. The content follows the
  // finger (with resistance) and springs back unless the drag passes the threshold.
  const swipeThreshold = Math.max(100, window.innerWidth * 0.3);
  const swipe = useRef<{
    x: number;
    y: number;
    dx: number;
    locked: boolean;
  } | null>(null);
  const pane = useRef<HTMLDivElement>(null);
  const settle = (dx: number) => {
    const el = pane.current;
    if (!el) return;
    el.style.transition = "transform 150ms ease-out, opacity 150ms ease-out";
    el.style.transform = dx ? `translateX(${dx}px)` : "";
    el.style.opacity = dx ? "0" : "";
  };
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, dx: 0, locked: false };
    if (pane.current) pane.current.style.transition = "";
  };
  const onTouchMove = (e: TouchEvent) => {
    const s = swipe.current;
    if (!s || isDesktop) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.locked) {
      if (Math.abs(dx) < 12) return;
      if (Math.abs(dx) < 1.5 * Math.abs(dy)) {
        swipe.current = null;
        return;
      }
      s.locked = true;
    }
    s.dx = dx;
    if (pane.current) {
      pane.current.style.transform = `translateX(${dx * 0.6}px)`;
      pane.current.style.opacity = String(
        Math.max(0.4, 1 - Math.abs(dx) / (swipeThreshold * 2)),
      );
    }
  };
  const onTouchEnd = () => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || isDesktop || !s.locked) return;
    if (Math.abs(s.dx) > swipeThreshold) {
      const dir = s.dx < 0 ? 1 : -1;
      settle(-dir * window.innerWidth);
      window.setTimeout(() => {
        step(dir);
        const el = pane.current;
        if (!el) return;
        el.style.transition = "";
        el.style.transform = `translateX(${dir * window.innerWidth * 0.4}px)`;
        el.style.opacity = "0";
        requestAnimationFrame(() => settle(0));
      }, 150);
    } else settle(0);
  };
  const changeView = (v: View) => {
    setView(v);
    if (v === "month") showMonth(monthKey(start));
    else if (v === "week") {
      setStart(startOfWeek(start));
      jumpToWeek(startOfWeek(start));
    } else setStart(todayKey());
  };
  const openDay = (d: string) => {
    setView("days");
    setDayCount(1);
    setStart(d);
  };

  const openShift = (shift: Shift) =>
    isAdmin ? setDraft({ ...shift }) : setDetail(shift);

  const first = fromDateKey(focusRange[0]);
  const last = fromDateKey(focusRange[focusRange.length - 1]);
  const title = isMonth
    ? formatMonth(visibleMonth)
    : isWeekFeed
      ? formatWeek(visibleWeek)
      : days === 1
        ? formatDateLong(range[0])
        : `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(
            undefined,
            {
              month: "short",
              day: "numeric",
              year: "numeric",
            },
          )}`;

  return (
    <div>
      <div
        ref={controls}
        className="sticky top-[53px] z-30 -mx-4 bg-slate-50 px-4 pt-1 md:static md:mx-0 md:bg-transparent md:px-0 md:pt-0"
      >
        <PageHeader
          title={isDesktop ? "Schedule" : formatDateShort(topDay ?? range[0])}
          subtitle={!isDesktop && days === 1 && !isMonth ? undefined : title}
          className="mb-2 md:mb-4"
          actions={
            isAdmin && (
              <>
                {!isMonth && (
                  <button
                    className="btn-secondary"
                    onClick={() => setCopying(startOfWeek(focusRange[0]))}
                    title="Copy this week's shifts to another week"
                  >
                    <Copy size={16} /> Copy week
                  </button>
                )}
                <button
                  className="btn-primary"
                  onClick={() =>
                    setDraft({
                      date: focusRange[0],
                      position: position || "Server",
                    })
                  }
                >
                  <Plus size={16} /> Shift
                </button>
              </>
            )
          }
        />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              className="btn-secondary px-2"
              onClick={() => step(-1)}
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <button className="btn-secondary" onClick={goToday}>
              Today
            </button>
            <button
              className="btn-secondary px-2"
              onClick={() => step(1)}
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm">
            {(["month", "week", "days"] as const).map((v) => (
              <button
                key={v}
                onClick={() => changeView(v)}
                className={`px-2.5 py-1.5 capitalize ${view === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {v}
              </button>
            ))}
          </div>

          {view === "days" && (
            <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  onClick={() => setDayCount(n)}
                  className={`px-2.5 py-1.5 ${days === n ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {n}
                </button>
              ))}
              <span className="hidden self-center px-2 text-xs text-slate-500 sm:inline">
                days
              </span>
            </div>
          )}

          {isDesktop && !isMonth && days > 1 && (
            <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm">
              {(["timeline", "list"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayout(l)}
                  aria-pressed={layout === l}
                  className={`px-2.5 py-1.5 capitalize ${layout === l ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={positionFilter.size === 0}
            onClick={() => setPositionFilter(new Set())}
          >
            All positions
          </FilterChip>
          {scheduledPositions.map((p) => (
            <FilterChip
              key={p}
              active={positionFilter.has(p)}
              onClick={() => togglePosition(p)}
            >
              {p}
            </FilterChip>
          ))}
          {stacked && (
            <DayPartToggle state={dayParts} compact className="ml-auto" />
          )}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={employeeFilter.size === 0}
            onClick={() => setEmployeeFilter(new Set())}
          >
            Everyone
          </FilterChip>
          {me && (
            <FilterChip
              active={employeeFilter.has(me.id)}
              color={me.color}
              onClick={() => toggleEmployee(me.id)}
            >
              Just me
            </FilterChip>
          )}
          {isAdmin && scheduledEmployees.length > 0 && (
            <StaffPicker
              employees={scheduledEmployees}
              selected={employeeFilter}
              onToggle={toggleEmployee}
              onClear={() => setEmployeeFilter(new Set())}
            />
          )}
        </div>
      </div>

      <div
        ref={pane}
        className="touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          swipe.current = null;
          settle(0);
        }}
      >
        {isDesktop && isMonth ? (
          <MonthGrid
            months={months}
            onNeedBefore={needBefore}
            onNeedAfter={needAfter}
            onVisibleMonth={setVisibleMonth}
            scrollTarget={scrollTarget}
            shifts={visible}
            employees={employees}
            hideNames={employeeFilter.size === 1}
            highlightEmployeeId={me?.id}
            offeredShiftIds={offeredShiftIds}
            onShiftClick={openShift}
            onDayClick={openDay}
            onAddClick={
              isAdmin
                ? (d) => setDraft({ position: position || "Server", ...d })
                : undefined
            }
            onQuickAdd={isAdmin ? createShift : undefined}
            onMoveShift={isAdmin ? moveShift : undefined}
            onCopyWeek={isAdmin ? setCopying : undefined}
            defaultPosition={position || "Server"}
          />
        ) : isWeekFeed ? (
          <WeekFeed
            weeks={weeks}
            onNeedBefore={needWeekBefore}
            onNeedAfter={needWeekAfter}
            onVisibleWeek={setVisibleWeek}
            scrollTarget={weekScrollTarget}
            shifts={visible}
            employees={employees}
            hideNames={employeeFilter.size === 1}
            highlightEmployeeId={me?.id}
            offeredShiftIds={offeredShiftIds}
            onShiftClick={openShift}
            onDayClick={openDay}
            onAddClick={
              isAdmin
                ? (d) => setDraft({ position: position || "Server", ...d })
                : undefined
            }
            onQuickAdd={isAdmin ? createShift : undefined}
            onMoveShift={isAdmin ? moveShift : undefined}
            onCopyWeek={isAdmin ? setCopying : undefined}
            defaultPosition={position || "Server"}
          />
        ) : (isDesktop && days > 1 && layout === "list") ||
          (!isDesktop && (isMonth || days > 1)) ? (
          <DayList
            days={range}
            stacked={!isDesktop}
            state={stacked ? dayParts : undefined}
            shifts={visible}
            employees={employees}
            hideNames={employeeFilter.size === 1}
            highlightEmployeeId={me?.id}
            offeredShiftIds={offeredShiftIds}
            onShiftClick={openShift}
            onDayClick={isDesktop ? openDay : undefined}
            onAddClick={
              isAdmin
                ? (d) => setDraft({ position: position || "Server", ...d })
                : undefined
            }
            onQuickAdd={isAdmin ? createShift : undefined}
            onMoveShift={isAdmin && isDesktop ? moveShift : undefined}
            defaultPosition={position || "Server"}
          />
        ) : isDesktop ? (
          <TimelineGrid
            days={range}
            shifts={visible}
            hideNames={employeeFilter.size === 1}
            employees={employees}
            highlightEmployeeId={me?.id}
            offeredShiftIds={offeredShiftIds}
            onShiftClick={openShift}
            onSlotClick={
              isAdmin
                ? (date, startMin) =>
                    setDraft({
                      date,
                      startMin,
                      endMin: Math.min(startMin + 300, 23 * 60),
                      position: position || "Server",
                    })
                : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {range.map((d) => {
              const dayShifts = visible
                .filter((s) => s.date === d)
                .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
              const isToday = d === todayKey();
              return (
                <section key={d}>
                  <h3
                    className={`mb-1.5 flex items-center gap-2 text-sm font-semibold ${isToday ? "text-slate-900" : "text-slate-600"}`}
                  >
                    {formatDateLong(d)}
                    {isToday && (
                      <span className="chip bg-slate-900 text-white">
                        Today
                      </span>
                    )}
                    <span className="ml-auto text-xs font-normal text-slate-400">
                      {dayShifts.length} shifts
                    </span>
                  </h3>
                  {dayShifts.length === 0 ? (
                    <EmptyState title="Nothing scheduled" />
                  ) : (
                    <div className="space-y-1.5">
                      {dayShifts.map((s) => (
                        <ShiftRow
                          key={s.id}
                          shift={s}
                          employee={employeeById(s.employeeId)}
                          onClick={() => openShift(s)}
                          trailing={
                            offeredShiftIds.has(s.id) ? (
                              <span className="chip bg-amber-100 text-amber-800">
                                trade
                              </span>
                            ) : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {draft && <ShiftModal draft={draft} onClose={() => setDraft(null)} />}
      {detail && (
        <ShiftDetailModal shift={detail} onClose={() => setDetail(null)} />
      )}
      {copying && (
        <CopyWeekModal
          sourceStart={copying}
          onClose={() => setCopying(null)}
          onDone={finishCopy}
        />
      )}
      {lastCopy && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
        >
          Copied {lastCopy.created.length} shift
          {lastCopy.created.length === 1 ? "" : "s"}
          {lastCopy.removed.length > 0 &&
            `, replaced ${lastCopy.removed.length}`}
          <button
            className="font-semibold text-amber-300 hover:text-amber-200"
            onClick={undoCopy}
            disabled={undoing}
          >
            {undoing ? "Undoing…" : "Undo"}
          </button>
          <button
            className="text-slate-400 hover:text-white"
            onClick={() => setLastCopy(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
