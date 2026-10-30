import type { ReactNode } from "react";

import type { Ticket } from "../../types/ticketTypes";
import { formatDate, ticketStatusBadgeClass, ticketStatusLabel } from "../../utils/ticketStatus";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";
import ReadOnlyField from "../common/ReadOnlyField";

interface TicketFieldsProps {
  ticket: Ticket;
  initiativeName?: string;
  leadEngineerName?: string;
}

// What the Product Manager asked for, read like a filled-in form: the key
// facts in one aligned row, then the scope, functional requirements and
// expected outcome full width, one under the other.
export function TicketFields({ ticket, initiativeName, leadEngineerName }: TicketFieldsProps) {
  const facts: { label: string; value: ReactNode }[] = [
    ...(initiativeName ? [{ label: "Initiative", value: initiativeName }] : []),
    ...(ticket.documentType
      ? [
          {
            label: "Built from",
            value: ticket.documentVersion ? `${ticket.documentType} · version ${ticket.documentVersion}` : ticket.documentType,
          },
        ]
      : []),
    ...(leadEngineerName ? [{ label: "Lead Engineer", value: leadEngineerName }] : []),
    {
      label: "Priority",
      value: <span className={priorityBadgeClass(ticket.priority)}>{priorityLabel(ticket.priority)}</span>,
    },
    { label: "Target date", value: formatDate(ticket.targetDate) },
    {
      label: "Status",
      value: <span className={ticketStatusBadgeClass(ticket.status)}>{ticketStatusLabel(ticket.status)}</span>,
    },
    { label: "Created", value: formatDate(ticket.createdAt) },
  ];

  return (
    <div className="ticket-view">
      <div className="ticket-view_facts">
        {facts.map((fact) => (
          <ReadOnlyField key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </div>

      <ReadOnlyField label="Scope" value={ticket.scope} />
      <ReadOnlyField label="Functional requirements" value={ticket.functionalRequirements} />
      <ReadOnlyField label="Expected outcome" value={ticket.expectedOutcome} />
    </div>
  );
}

interface TicketBriefProps {
  ticket: Ticket;
  initiativeName: string;
  // e.g. "From Ada (Product Manager)".
  requestedBy?: string;
}

// The ticket as its own panel, on the Lead Engineer's and Developer's pages.
function TicketBrief({ ticket, initiativeName, requestedBy }: TicketBriefProps) {
  return (
    <section className="dashboard-panel initiative-detail-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>{ticket.requestNumber ? `Ticket ${ticket.requestNumber}` : "Ticket"}</h2>
          {requestedBy && <p>{requestedBy}</p>}
        </div>
      </div>

      <div className="proposal-section">
        <TicketFields ticket={ticket} initiativeName={initiativeName} />
      </div>
    </section>
  );
}

export default TicketBrief;
