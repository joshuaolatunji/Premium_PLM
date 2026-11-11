import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronRight, ClipboardCheck, FileText, ListTodo, PenLine, Plus, X, type LucideIcon } from "lucide-react";

import { getCurrentUserFirstName } from "../../apicalls/authStorage";
import { isRejectedAtSignOff } from "../../service/MemoService";
import { MEMO_STATUS } from "../../types/memoTypes";
import type { MemoRow } from "../../types/memoTypes";
import { backState } from "../../utils/navigation";
import { useCountUp } from "../../utils/useCountUp";
import { useMemoLists } from "../../utils/useMemoLists";
import MemoTable from "../../components/memos/MemoTable";
import SplitText from "../../components/ui/SplitText";
import FluidOrb from "../../components/ui/FluidOrb";

type CardId = "review" | "sign" | "action" | "mine";
type StageId = "draft" | "review" | "ready" | "signing" | "signed" | "returned";

interface Card {
  id: CardId;
  icon: LucideIcon;
  label: string;
  rows: MemoRow[];
  // Waiting on the user, rather than memos they're following.
  needsAction: boolean;
  hint: string;
  title: string;
  description: string;
  emptyText: string;
  actionLabel: string;
}

// The stages of the user's own memos, from draft to fully signed.
const STAGES: { id: StageId; label: string; statuses: string[] }[] = [
  { id: "draft", label: "Drafts", statuses: [MEMO_STATUS.draft] },
  { id: "review", label: "In review", statuses: [MEMO_STATUS.inReview, MEMO_STATUS.withGroupHead] },
  { id: "ready", label: "Ready for signing", statuses: [MEMO_STATUS.reviewed, MEMO_STATUS.readyForApproval] },
  { id: "signing", label: "Out for signing", statuses: [MEMO_STATUS.inApproval] },
  { id: "signed", label: "Fully signed", statuses: [MEMO_STATUS.approved] },
  { id: "returned", label: "Declined or rejected", statuses: [MEMO_STATUS.reviewDeclined, MEMO_STATUS.reviewRejected, MEMO_STATUS.changesRequested] },
];

const LIST_SIZE = 8;

function inStage(row: MemoRow, stage: (typeof STAGES)[number]): boolean {
  return stage.statuses.includes(row.status) || (stage.id === "returned" && isRejectedAtSignOff(row.status));
}

// A card's count, rolling up to its value when the page opens.
function CardCount({ value }: { value: number }) {
  return <span className="memo-dash-card__value">{useCountUp(value)}</span>;
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// Every role's dashboard while the app focuses on memos (config/features.ts):
// a red card per memo list, each a filter for the list below it, and the
// user's own memos by stage, each also a filter.
function MemoDashboard() {
  const navigate = useNavigate();
  const memos = useMemoLists();
  const [searchParams, setSearchParams] = useSearchParams();

  const name = getCurrentUserFirstName();

  const cards: Card[] = [
    {
      id: "sign",
      icon: PenLine,
      label: "Memos To Sign",
      rows: memos.toSign,
      needsAction: true,
      hint: "Waiting for your signature",
      title: "Waiting for your signature",
      description: "Read each one, then sign or reject it.",
      emptyText: "No memos are waiting for your signature.",
      actionLabel: "Review & sign",
    },
    {
      id: "action",
      icon: ListTodo,
      label: "Pending Actions",
      rows: memos.toAction,
      needsAction: true,
      hint: "Your memos waiting on you",
      title: "Your memos waiting on you",
      description: "Declined in review, ready to send for signing, or rejected at signing.",
      emptyText: "None of your memos are waiting on you.",
      actionLabel: "Open",
    },
    {
      id: "review",
      icon: ClipboardCheck,
      label: "Memos To Review",
      rows: memos.toReview,
      needsAction: true,
      hint: "Waiting for your review",
      title: "Waiting for your review",
      description: "Approve each one, or decline it with a reason.",
      emptyText: "No memos are waiting for your review.",
      actionLabel: "Review",
    },
    {
      id: "mine",
      icon: FileText,
      label: "My Memos",
      rows: memos.mine,
      needsAction: false,
      hint: "Written by you",
      title: "Your memos",
      description: "Every memo you've written, most recent first.",
      emptyText: "You haven't written any memos yet.",
      actionLabel: "View",
    },
  ];

  // The filter lives in the address (?filter=sign, ?filter=stage:draft), so
  // it survives a refresh and Back from a memo.
  const filter = searchParams.get("filter") ?? "";
  const activeCard = cards.find((card) => card.id === filter) ?? null;
  const activeStage = STAGES.find((stage) => `stage:${stage.id}` === filter) ?? null;

  function toggle(value: string) {
    const params = new URLSearchParams(searchParams);
    if (filter === value) params.delete("filter");
    else params.set("filter", value);
    setSearchParams(params, { replace: true });
  }

  // A click anywhere outside the cards also clears the filter. Clicks in the
  // list it filters and in the stage panel don't, so opening a memo from the
  // list (or choosing a stage) keeps it.
  const cardsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const stagesRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!filter) return;

    function clearOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      if ([cardsRef, listRef, stagesRef].some((ref) => ref.current?.contains(target))) return;

      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          params.delete("filter");
          return params;
        },
        { replace: true },
      );
    }

    document.addEventListener("pointerdown", clearOnOutsideClick);
    return () => document.removeEventListener("pointerdown", clearOnOutsideClick);
  }, [filter, setSearchParams]);

  // With no filter: everything waiting on the user, newest first.
  const waiting = [...memos.toReview, ...memos.toSign, ...memos.toAction]
    .filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const waitingCount = waiting.length;

  const list = activeCard
    ? activeCard
    : activeStage
      ? {
          title: activeStage.label,
          description: "Your memos at this stage, most recent first.",
          rows: memos.mine.filter((row) => inStage(row, activeStage)),
          emptyText: "None of your memos are at this stage.",
          actionLabel: "View",
        }
      : {
          title: "Needs your attention",
          description: "Memos waiting for your review or signature, and your own memos waiting on you.",
          rows: waiting,
          emptyText: "You're all caught up. Nothing is waiting on you.",
          actionLabel: "Open",
        };

  const shown = list.rows.slice(0, LIST_SIZE);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="dashboard-page memo-dash">
      <header className="memo-dash__hero">
        <div>
          <p className="memo-dash__eyebrow">{today}</p>

          {/* React Bits SplitText: the letters rise into place from behind a
              mask, one after another, as the dashboard opens. */}
          <SplitText
            tag="h1"
            className="memo-dash__title"
            text={`${greeting()}${name ? `, ${name}` : ""}`}
            splitType="chars"
            effect="rise"
            mask
            delay={22}
            duration={0.9}
            ease="power3.out"
            trigger="load"
            textAlign="left"
          />

          <p className="memo-dash__summary">
            {memos.isLoading
              ? "Loading your memos…"
              : waitingCount > 0
                ? `${waitingCount} ${waitingCount === 1 ? "memo is" : "memos are"} waiting on you.`
                : "You're all caught up. Nothing is waiting on you."}
          </p>
        </div>

        <div className="dashboard-header__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => navigate("/dashboard/memos/new", { state: backState("Back to dashboard") })}
          >
            <Plus size={17} strokeWidth={2} aria-hidden="true" />
            Create memo
          </button>
        </div>
      </header>

      {memos.isError && (
        <p className="initiatives-empty initiatives-empty--error">Couldn't load your memos. Try refreshing the page.</p>
      )}

      <div ref={cardsRef} className={activeCard ? "memo-dash__cards memo-dash__cards--filtering" : "memo-dash__cards"}>
        {cards.map(({ id, icon: Icon, label, rows, needsAction, hint }) => {
          const active = activeCard?.id === id;
          const pending = needsAction && rows.length > 0;

          return (
            <button
              key={id}
              type="button"
              className={active ? "memo-dash-card memo-dash-card--active" : "memo-dash-card"}
              aria-pressed={active}
              data-tooltip={active ? "Clear filter" : `Show ${label.toLowerCase()}`}
              onClick={() => toggle(id)}
            >
              <Icon className="memo-dash-card__watermark" aria-hidden="true" strokeWidth={1.2} />

              <span className="memo-dash-card__head">
                <span className="memo-dash-card__icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.9} />
                </span>
                <span className="memo-dash-card__label">{label}</span>
                {pending && <span className="memo-dash-card__pulse" aria-hidden="true" />}
              </span>

              {memos.isLoading ? <span className="memo-dash-card__value">–</span> : <CardCount value={rows.length} />}

              <span className="memo-dash-card__foot">
                <span>{memos.isLoading ? "Loading…" : pending || !needsAction ? hint : "All caught up"}</span>
                {/* Says what a click does: filter the list, or (when showing) clear it. */}
                <span className="memo-dash-card__state">
                  {active ? "Showing" : "Filter"}
                  {active ? (
                    <X size={13} strokeWidth={2.6} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} strokeWidth={2.6} aria-hidden="true" />
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="memo-dash__body">
        <section ref={listRef} className="dashboard-panel memo-list">
          <div className="memo-list__header">
            {/* The heading slides across to the newly chosen list. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={list.title}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <h2>{list.title}</h2>
                <p>{list.description}</p>
              </motion.div>
            </AnimatePresence>

            <div className="memo-dash__list-actions">
              {(activeCard || activeStage) && (
                <button type="button" className="button button--secondary" onClick={() => toggle(filter)}>
                  <X size={15} aria-hidden="true" />
                  Clear filter
                </button>
              )}
            </div>
          </div>

          <MemoTable
            rows={shown}
            emptyText={list.emptyText}
            backLabel="Back to dashboard"
            actionLabel={list.actionLabel}
            isLoading={memos.isLoading}
            // Nothing waiting at all: a calm, slowly drifting red orb (Rare UI).
            emptyArt={!activeCard && !activeStage ? <FluidOrb size={72} color="#dd2025" aria-hidden="true" /> : undefined}
          />

          {list.rows.length > LIST_SIZE && (
            <div className="memo-dash__list-foot">
              <span>
                Showing {LIST_SIZE} of {list.rows.length}
              </span>
              <button type="button" className="memo-dash__link" onClick={() => navigate("/dashboard/memos")}>
                See all in Memos
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>

        <aside ref={stagesRef} className="dashboard-panel memo-dash-stages">
          <div className="memo-list__header">
            <div>
              <h2>Your memos by stage</h2>
              <p>From draft to fully signed. Choose a stage to list its memos.</p>
            </div>
          </div>

          <ul className="memo-dash-stages__list">
            {STAGES.map((stage) => {
              const count = memos.mine.filter((row) => inStage(row, stage)).length;
              const share = memos.mine.length > 0 ? (count / memos.mine.length) * 100 : 0;
              const active = activeStage?.id === stage.id;

              return (
                <li key={stage.id}>
                  <button
                    type="button"
                    className={
                      active
                        ? `memo-dash-stage memo-dash-stage--${stage.id} memo-dash-stage--active`
                        : `memo-dash-stage memo-dash-stage--${stage.id}`
                    }
                    aria-pressed={active}
                    onClick={() => toggle(`stage:${stage.id}`)}
                  >
                    <span className="memo-dash-stage__label">{stage.label}</span>
                    <span className="memo-dash-stage__count">{memos.isLoading ? "–" : count}</span>
                    <span className="memo-dash-stage__go" aria-hidden="true">
                      {active ? <X size={15} /> : <ChevronRight size={16} />}
                    </span>
                    <span className="memo-dash-stage__bar" aria-hidden="true">
                      <span className="memo-dash-stage__fill" style={{ width: `${share}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="memo-dash-stages__total">
            <span>Total written</span>
            <strong>{memos.isLoading ? "–" : memos.mine.length}</strong>
          </p>
        </aside>
      </div>
    </div>
  );
}

export default MemoDashboard;
