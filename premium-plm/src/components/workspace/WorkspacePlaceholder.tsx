import { Construction } from "lucide-react";

interface WorkspacePlaceholderProps {
  breadcrumb: string;
  title: string;
  description: string;
  upcoming: string[];
}

// Shared "coming soon" screen for role workspaces whose real functionality
// (and, in most cases, backing API endpoints) doesn't exist yet — see the
// roadmap in the approval-chain plan. Not a broken page: it names what will
// actually land here.
function WorkspacePlaceholder({
  breadcrumb,
  title,
  description,
  upcoming,
}: WorkspacePlaceholderProps) {
  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">{breadcrumb}</p>

          <h1 className="dashboard-title">{title}</h1>

          <p className="dashboard-subtitle">{description}</p>
        </div>
      </header>

      <section className="dashboard-panel workspace-placeholder">
        <div className="workspace-placeholder_icon">
          <Construction size={28} strokeWidth={1.75} />
        </div>

        <h2 className="workspace-placeholder_title">This workspace is being built</h2>

        <p className="workspace-placeholder_body">
          It'll cover:
        </p>

        <ul className="workspace-placeholder_list">
          {upcoming.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default WorkspacePlaceholder;
