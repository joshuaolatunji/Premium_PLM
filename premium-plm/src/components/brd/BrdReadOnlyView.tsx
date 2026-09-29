import { REQUIREMENT_CATEGORY_VALUES, REQUIREMENT_PRIORITY_VALUES } from "../../types/proposalTypes";
import type { ProductProposal } from "../../types/proposalTypes";

interface FieldProps {
  label: string;
  value: string;
}

function Field({ label, value }: FieldProps) {
  return (
    <div>
      <span className="initiative-detail-grid_label">{label}</span>
      <span className="initiative-detail-grid_value brd-readonly-value">
        {value || "—"}
      </span>
    </div>
  );
}

// A document-style, read-only rendering of a BRD — used wherever someone
// reviews a submitted BRD rather than edits it (unlike BrdEditor.tsx, whose
// form is only appropriate for the author).
function BrdReadOnlyView({ proposal }: { proposal: ProductProposal }) {
  return (
    <>
      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Overview</h2>
          </div>
        </div>

        <div className="initiative-detail-grid">
          <Field label="Author" value={proposal.author} />
          <Field label="Sponsor" value={proposal.sponsor} />
          <Field label="User group" value={proposal.userGroup} />
          <Field label="Project manager" value={proposal.projectManager} />
        </div>

        <div className="proposal-section">
          <Field label="Introduction" value={proposal.introduction} />
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Business case</h2>
          </div>
        </div>

        <div className="proposal-section">
          <Field label="Business objective" value={proposal.businessObjective} />
          <Field label="Business purpose" value={proposal.businessPurpose} />
          <Field label="Objectives and goals" value={proposal.objectivesAndGoals} />
          <Field label="Target customers" value={proposal.targetCustomers} />
          <Field label="Product purpose" value={proposal.productPurpose} />
          <Field label="Need statement" value={proposal.needStatement} />
          <Field label="Affects" value={proposal.affects} />
          <Field label="Impact" value={proposal.impact} />
          <Field label="Successful solution" value={proposal.successfulSolution} />
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Classification</h2>
          </div>
        </div>

        <div className="initiative-detail-grid">
          <Field
            label="New application development"
            value={proposal.newApplicationDevelopment ? "Yes" : "No"}
          />
          <Field
            label="Replacement of existing application"
            value={proposal.replacementOfExistingApplication ? "Yes" : "No"}
          />
          <Field label="RFP or RFQ" value={proposal.rfpOrRfq ? "Yes" : "No"} />
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Scope &amp; process</h2>
          </div>
        </div>

        <div className="proposal-section">
          <Field label="Project scope" value={proposal.projectScope} />
          <Field label="Process flow — as is" value={proposal.processFlowAsIs} />
          <Field label="Process flow — to be" value={proposal.processFlowToBe} />
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Financials</h2>
          </div>
        </div>

        <div className="initiative-detail-grid">
          <Field label="Minimum amount" value={String(proposal.minimumAmount)} />
          <Field label="Maximum amount" value={String(proposal.maximumAmount)} />
          <Field label="Tenure (months)" value={String(proposal.tenureInMonths)} />
          <Field label="Repayment frequency" value={proposal.repaymentFrequency} />
          <Field
            label="Proposed interest rate"
            value={`${proposal.proposedInterestRate}%`}
          />
        </div>

        <div className="proposal-section">
          <Field label="Expected benefits" value={proposal.expectedBenefits} />
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Functionalities</h2>
          </div>
        </div>

        <div className="proposal-subtable-wrapper">
          <table className="proposal-subtable">
            <thead>
              <tr>
                <th>#</th>
                <th>Functionality</th>
                <th>Description</th>
              </tr>
            </thead>

            <tbody>
              {proposal.functionalities.map((row) => (
                <tr key={row.sequence}>
                  <td>{row.sequence}</td>
                  <td>{row.functionality}</td>
                  <td>{row.description}</td>
                </tr>
              ))}

              {proposal.functionalities.length === 0 && (
                <tr>
                  <td colSpan={3} className="initiatives-empty">
                    No functionalities listed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>User groups</h2>
          </div>
        </div>

        <div className="proposal-subtable-wrapper">
          <table className="proposal-subtable">
            <thead>
              <tr>
                <th>#</th>
                <th>User class</th>
                <th>Description</th>
                <th>Role / function</th>
              </tr>
            </thead>

            <tbody>
              {proposal.userGroups.map((row) => (
                <tr key={row.sequence}>
                  <td>{row.sequence}</td>
                  <td>{row.userClass}</td>
                  <td>{row.description}</td>
                  <td>{row.roleFunction}</td>
                </tr>
              ))}

              {proposal.userGroups.length === 0 && (
                <tr>
                  <td colSpan={4} className="initiatives-empty">
                    No user groups listed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Requirements</h2>
            <p>
              Category and priority are undocumented numeric codes in the
              API — shown as plain numbers (of {REQUIREMENT_CATEGORY_VALUES.length}{" "}
              categories, {REQUIREMENT_PRIORITY_VALUES.length} priorities).
            </p>
          </div>
        </div>

        <div className="proposal-subtable-wrapper">
          <table className="proposal-subtable">
            <thead>
              <tr>
                <th>#</th>
                <th>Category</th>
                <th>Requirement</th>
                <th>Priority</th>
                <th>Comments</th>
              </tr>
            </thead>

            <tbody>
              {proposal.requirements.map((row) => (
                <tr key={row.sequence}>
                  <td>{row.sequence}</td>
                  <td>Category {row.category}</td>
                  <td>{row.requirement}</td>
                  <td>Priority {row.priority}</td>
                  <td>{row.comments}</td>
                </tr>
              ))}

              {proposal.requirements.length === 0 && (
                <tr>
                  <td colSpan={5} className="initiatives-empty">
                    No requirements listed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default BrdReadOnlyView;
