import {useState} from "react";
import {Bell, Menu, Search} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import UserAvatar from "../ui/UserAvatar";
import { getStoredUser } from "../../apicalls/authStorage";
import { capitalize, formatRoleName } from "../../utils/text";
import { getUnreadCount } from "../../service/NotificationService";

interface TopbarProps {
    // Opens the sidebar drawer below its breakpoint; the button this calls
    // is itself hidden by CSS above that breakpoint, where the sidebar is
    // already permanently visible.
    onMenuClick: () => void;
}

function Topbar({ onMenuClick }: TopbarProps) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const user = getStoredUser();
    const roles = user?.roles ?? [];
    const displayName = user?.userName ? capitalize(user.userName) : "Guest";

    const unreadCountQuery = useQuery({
        queryKey: ["notifications-unread-count"],
        queryFn: getUnreadCount,
    });

    const unreadCount = unreadCountQuery.data ?? 0;

    return(
        <header className="topbar">
            <div className="topbar_left">
                <button
                    type="button"
                    className="topbar_menu"
                    onClick={onMenuClick}
                    aria-label="Open menu"
                >
                    <Menu size={20} />
                </button>

                <div className="topbar_breadcrumb">
                    <span>Premium PLM</span>
                    <span>/</span>
                    <span>Dashboard</span>

                </div>
            </div>

            <div className="topbar_actions">
                <form
                    className="topbar_search"
                    role="search"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const term = searchTerm.trim();
                        navigate(
                            term
                                ? `/dashboard/initiatives?q=${encodeURIComponent(term)}`
                                : "/dashboard/initiatives",
                        );
                        setSearchTerm("");
                    }}
                >
                    <Search size={16} />

                    <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search initiatives..."
                    aria-label="Search initiatives" />

                </form>

                <button
                    className="topbar_notification"
                    onClick={() => navigate("/dashboard/notifications")}
                    aria-label="Notifications"
                >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                        <span className="topbar_notification-badge">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    className="topbar_user"
                    onClick={() => navigate("/dashboard/profile")}
                >
                    <div className="topbar_avatar">
                        <UserAvatar name={displayName} size="md"/>
                    </div>

                    <div>
                        <p className="topbar_user-name">
                            <strong>{displayName}</strong>
                        </p>

                        <p className="topbar_user-role">
                            <span>{roles.length > 0 ? roles.map(formatRoleName).join(" · ") : "—"}</span>
                        </p>
                    </div>
                </button>



            </div>


        </header>
    )
}

export default Topbar;
