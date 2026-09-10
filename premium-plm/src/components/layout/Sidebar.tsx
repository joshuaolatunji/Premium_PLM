import {
  Bell,
  ClipboardCheck,
  FileText,
  Gauge,
  History,
  LayoutDashboard,
  ListOrdered,
} from "lucide-react";

function Sidebar() {
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
                <p className="sidebar_section-title">
                    Governance
                </p>


                <a href="#" className="sidebar_link sidebar_link--active">
                    <LayoutDashboard size={16} />
                    <span>Dashboard</span>
                </a>

                <a href="#" className="sidebar_link">
                    <Gauge size={16} />
                    <span>Initiatives</span>
                </a>

                <a href="#" className="sidebar_link">
                    <FileText size={16} />
                    <span>BRD Reviews</span>
                </a>

                <a href="#" className="sidebar_link">
                    <ClipboardCheck size={16} />
                    <span>Portfolio</span>
                </a>

                <a href="#" className="sidebar_link">
                    <ListOrdered size={16} />
                    <span>Priorities</span>
                </a>

                <a href="#" className="sidebar_link">
                    <Bell size={16} />
                    <span>Notifications</span>
                </a>

                <a href="#" className="sidebar_link">
                    <History size={16} />
                    <span>Audit Trail</span>
                </a>

            </nav>


            <div className="sidebar_footer">
                <div className="sidebar_avatar">
                    CO
                </div>

                <div>
                    <p className="sidebar_user-name">
                        <strong>Chidinma Okeke</strong>
                    </p>

                    <p className="sidebar_user-role">
                        <span>Group Head</span>
                    </p>
                </div>

            </div>



        </aside>
    )
}


export default Sidebar;