import {Bell, Search} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import UserAvatar from "../ui/UserAvatar";
import { getStoredUser } from "../../apicalls/authStorage";
import { capitalize } from "../../utils/text";
import { getUnreadCount } from "../../service/NotificationService";


function Topbar() {
    const navigate = useNavigate();
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
            <div className="topbar_breadcrumb">
                <span>Premium PLM</span>
                <span>/</span>
                <span>Dashboard</span>

            </div>

            <div className="topbar_actions">
                <div className="topbar_search">
                    <Search size={16} />

                    <input
                    type="text"
                    placeholder="Search Initiatives, BRDs, People..." />

                </div>

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

                <div className="topbar_user">
                    <div className="topbar_avatar">
                        <UserAvatar name={displayName} size="md"/>
                    </div>
                </div>

                <div>
                    <p className="topbar_user-name">
                        <strong>{displayName}</strong>
                    </p>

                    <p className="topbar_user-role">
                        <span>{roles.length > 0 ? roles.join(" · ") : "—"}</span>
                    </p>
                </div>



            </div>


        </header>
    )
}

export default Topbar;
