import { useNavigate } from "react-router-dom";

import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import type { DashboardStat } from "../../types/dashboardTypes";
import { useMemoLists } from "../../utils/useMemoLists";

// The memo cards in a dashboard's row of stat cards, the same for every
// role: memos waiting for the user's review or signature, their own memos
// waiting on them, and every memo they've written. Each opens its tab on the
// Memos page. Rendered inside the page's own .dashboard-stats grid, so they
// line up with its other cards.
function MemoStatCards() {
  const navigate = useNavigate();
  const lists = useMemoLists();

  function stat(view: string, label: string, count: number, waiting: string, none: string, urgent: boolean) {
    const card: DashboardStat = {
      label,
      value: count,
      description: lists.isLoading ? "Loading…" : lists.isError ? "Couldn't load" : count > 0 ? waiting : none,
      descriptionType: lists.isError ? "danger" : count > 0 && urgent ? "warning" : "neutral",
    };
    return { view, card };
  }

  const cards = [
    stat("sign", "Memos To Sign", lists.toSign.length, "Waiting for your signature", "All caught up", true),
    stat("action", "Pending Actions", lists.toAction.length, "Your memos waiting on you", "All caught up", true),
    stat("review", "Memos To Review", lists.toReview.length, "Waiting for your review", "All caught up", true),
    stat("mine", "My Memos", lists.mine.length, "Written by you", "None written yet", false),
  ];

  return (
    <>
      {cards.map(({ card }) => (
        <DashboardStatCard key={card.label} stat={card} onClick={() => navigate("/dashboard/memos")} />
      ))}
    </>
  );
}

export default MemoStatCards;
