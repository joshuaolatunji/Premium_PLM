import {Bell, Search} from "lucide-react";
import UserAvatar from "../ui/UserAvatar";


function Topbar() {
    return(
        <header className="topbar">
            <div className="topbar_breadcrumb">
                <span>Premium PLM</span>
                <span>/</span>
                <span>Dashboard</span>
                <strong>Dashboard</strong>
            </div>

            <div className="topbar_actions">
                <div className="topbar_search">
                    <Search size={16} />

                    <input 
                    type="text" 
                    placeholder="Search Initiatives, BRDs, People..." />

                </div>

                <button className="topbar_notification">
                    <Bell size={18} />
                    <span className="topbar_notification-badge">
                        7
                    </span>
                </button>

                <div className="topbar_user">
                    <div className="topbar_avatar">
                        <UserAvatar name="Abdulmuiz Adewale" size="md"/>
                    </div>
                </div>

                <div>
                    <p className="topbar_user-name">
                        <strong>Abdulmuiz Adewale</strong>
                    </p>

                    <p className="topbar_user-role">
                        <span>Group Head</span>
                    </p>
                </div>



            </div>


        </header>
    )
}

export default Topbar;