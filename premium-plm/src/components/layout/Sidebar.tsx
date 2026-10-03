import { NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  Briefcase,
  Code2,
  FileText,
  Gauge,
  HardHat,
  History,
  LayoutDashboard,
  ListOrdered,
  Tags,
  Ticket,
  Users,
} from "lucide-react";

import UserAvatar from "../ui/UserAvatar"
import { getStoredUser } from "../../apicalls/authStorage";
import { resolvePrimaryRole } from "../../utils/roleRouting";
import { capitalize, formatRoleName } from "../../utils/text";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "sidebar_link sidebar_link--active" : "sidebar_link";
}

function GroupHeadNav() {
    return (
        <>
            <p className="sidebar_section-title">
                Governance
            </p>

            <NavLink to="/dashboard" end className={navLinkClass}>
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
            </NavLink>

            <NavLink to="/dashboard/initiatives" className={navLinkClass}>
                <Gauge size={16} />
                <span>Initiatives</span>
            </NavLink>

            <NavLink to="/dashboard/bdo-reviews" className={navLinkClass}>
                <Briefcase size={16} />
                <span>BDO Reviews</span>
            </NavLink>

            <NavLink to="/dashboard/brd-reviews" className={navLinkClass}>
                <FileText size={16} />
                <span>BRD Reviews</span>
            </NavLink>

            <NavLink to="/dashboard/priorities" className={navLinkClass}>
                <ListOrdered size={16} />
                <span>Priorities</span>
            </NavLink>

            <NavLink to="/dashboard/notifications" className={navLinkClass}>
                <Bell size={16} />
                <span>Notifications</span>
            </NavLink>

            <NavLink to="/dashboard/audit-trail" className={navLinkClass}>
                <History size={16} />
                <span>Audit Trail</span>
            </NavLink>
        </>
    );
}

function SuperAdminNav() {
    return (
        <>
            <GroupHeadNav />

            <p className="sidebar_section-title">
                Administration
            </p>

            <NavLink to="/dashboard/admin/users" className={navLinkClass}>
                <Users size={16} />
                <span>Users</span>
            </NavLink>

            <NavLink to="/dashboard/admin/categories" className={navLinkClass}>
                <Tags size={16} />
                <span>Categories</span>
            </NavLink>
        </>
    );
}

function BdoNav() {
    return (
        <>
            <p className="sidebar_section-title">
                Delivery
            </p>

            <NavLink to="/dashboard/bdo" end className={navLinkClass}>
                <Briefcase size={16} />
                <span>Dashboard</span>
            </NavLink>

            <NavLink to="/dashboard/bdo-brd-reviews" className={navLinkClass}>
                <FileText size={16} />
                <span>BRD Reviews</span>
            </NavLink>

            <NavLink to="/dashboard/notifications" className={navLinkClass}>
                <Bell size={16} />
                <span>Notifications</span>
            </NavLink>
        </>
    );
}

function ProjectManagerNav() {
    return (
        <>
            <p className="sidebar_section-title">
                Delivery
            </p>

            <NavLink to="/dashboard/my-work" className={navLinkClass}>
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
            </NavLink>

            <NavLink to="/dashboard/brds" className={navLinkClass}>
                <FileText size={16} />
                <span>BRDs</span>
            </NavLink>

            <NavLink to="/dashboard/my-tickets" className={navLinkClass}>
                <Ticket size={16} />
                <span>Tickets</span>
            </NavLink>

            <NavLink to="/dashboard/notifications" className={navLinkClass}>
                <Bell size={16} />
                <span>Notifications</span>
            </NavLink>
        </>
    );
}

function LeadEngineerNav() {
    return (
        <>
            <p className="sidebar_section-title">
                Delivery
            </p>

            <NavLink to="/dashboard/lead-engineer" end className={navLinkClass}>
                <HardHat size={16} />
                <span>Tickets</span>
            </NavLink>

            <NavLink to="/dashboard/notifications" className={navLinkClass}>
                <Bell size={16} />
                <span>Notifications</span>
            </NavLink>
        </>
    );
}

function DeveloperNav() {
    return (
        <>
            <p className="sidebar_section-title">
                Delivery
            </p>

            <NavLink to="/dashboard/developer" end className={navLinkClass}>
                <Code2 size={16} />
                <span>Tickets</span>
            </NavLink>

            <NavLink to="/dashboard/notifications" className={navLinkClass}>
                <Bell size={16} />
                <span>Notifications</span>
            </NavLink>
        </>
    );
}

function Sidebar() {
    const navigate = useNavigate();
    const user = getStoredUser();
    const roles = user?.roles ?? [];
    const displayName = user?.userName ? capitalize(user.userName) : "Guest";

    // Same role-priority rule as the post-login landing route and the
    // /dashboard index redirect (see utils/roleRouting.ts), so the sidebar
    // and the page you land on always agree. Each role sees only its own
    // nav, not a merged one.
    const primaryRole = resolvePrimaryRole(roles);

    return (
        <aside className="sidebar">
            <div className="sidebar_brand">
                <div className="sidebar_brand-logo">
                    <img src="/premium-logo-white.png" alt="Premium Trust Bank Logo" />
                </div>


                <div className="sidebar_product">
                    Premium PLM
                    <span>v1.0</span>
                </div>
            </div>

            <nav className="sidebar_navigation">
                {primaryRole === "SuperAdmin" && <SuperAdminNav />}
                {primaryRole === "BusinessDevelopmentOfficer" && <BdoNav />}
                {primaryRole === "ProjectManager" && <ProjectManagerNav />}
                {primaryRole === "LeadEngineer" && <LeadEngineerNav />}
                {primaryRole === "SoftwareEngineer" && <DeveloperNav />}
                {(primaryRole === "GroupHead" || primaryRole === "Other") && (
                    <GroupHeadNav />
                )}
            </nav>


            <button
                type="button"
                className="sidebar_footer"
                onClick={() => navigate("/dashboard/profile")}
            >
                <div className="sidebar_avatar">
                    <UserAvatar name={displayName} />
                </div>

                <div>
                    <p className="sidebar_user-name">
                        <strong>{displayName}</strong>
                    </p>

                    <p className="sidebar_user-role">
                        <span>{roles.length > 0 ? roles.map(formatRoleName).join(" · ") : "—"}</span>
                    </p>
                </div>

            </button>



        </aside>
    )
}


export default Sidebar;
