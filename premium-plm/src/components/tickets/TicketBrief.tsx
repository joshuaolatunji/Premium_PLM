import type { Ticket } from "../../types/ticketTypes";
import { formatDate } from "../../utils/ticketStatus";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";

interface TicketBriefProps {
  ticket: Ticket;
  initiativeName: string;
  // e.g. "From Ada (Product Manager)".
  requestedBy?: string;
}

// What the Product Manager asked for on a ticket.
function TicketBrief({ ticket, initiativeName, requestedBy }: TicketBriefProps) {
  return (
    <section className="dashboard-panel initiative-detail-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>{ticket.requestNumber ? `Ticket ${ticket.requestNumber}` : "Ticket"}</h2>
          {requestedBy && <p>{requestedBy}</p>}
        </div>
      </div>

      <div className="initiative-detail-grid">
        <div>
          <span className="initiative-detail-grid_label">Initiative</span>
          <span className="initiative-detail-grid_value">{initiativeName}</span>
        </div>

        {ticket.documentType && (
          <div>
            <span className="initiative-detail-grid_label">Built from</span>
            <span className="initiative-detail-grid_value">
              {ticket.documentType}
              {ticket.documentVersion ? ` · version ${ticket.documentVersion}` : ""}
            </span>
          </div>
        )}

        <div>
          <span className="initiative-detail-grid_label">Priority</span>
          <span className="initiative-detail-grid_value">
            <span className={priorityBadgeClass(ticket.priority)}>{priorityLabel(ticket.priority)}</span>
          </span>
        </div>

        <div>
          <span className="initiative-detail-grid_label">Target date</span>
          <span className="initiative-detail-grid_value">{formatDate(ticket.targetDate)}</span>
        </div>

        <div>
          <span className="initiative-detail-grid_label">Created</span>
          <span className="initiative-detail-grid_value">{formatDate(ticket.createdAt)}</span>
        </div>
      </div>

      <dl className="ticket-details_grid ticket-details_grid--panel">
        <div>
          <dt>Scope</dt>
          <dd>{ticket.scope || "—"}</dd>
        </div>
        <div>
          <dt>Functional requirements</dt>
          <dd>{ticket.functionalRequirements || "—"}</dd>
        </div>
        <div>
          <dt>Expected outcome</dt>
          <dd>{ticket.expectedOutcome || "—"}</dd>
        </div>
      </dl>
    </section>
  );
}

export default TicketBrief;
