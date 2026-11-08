import CreateMemoButton from "./CreateMemoButton";

interface InitiativeMemosPanelProps {
  initiativeId: string;
  initiativeName: string;
}

// The memos attached to an initiative, under its documents. The Product
// Manager and the Group Head can add one. Listing them needs the memo list
// to say which initiative each memo is for (gaps file M26).
function InitiativeMemosPanel({ initiativeId, initiativeName }: InitiativeMemosPanelProps) {
  return (
    <section className="dashboard-panel initiative-detail-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>Memos</h2>
          <p>Memos for this initiative, each reviewed by the people its author chooses and then signed.</p>
        </div>

        <CreateMemoButton initiativeId={initiativeId} backLabel={`Back to ${initiativeName}`} />
      </div>

      <p className="initiatives-empty">
        This initiative's memos can't be listed here yet: the server's memo list doesn't say which initiative each
        memo belongs to. Find them on the Memos page.
      </p>
    </section>
  );
}

export default InitiativeMemosPanel;
