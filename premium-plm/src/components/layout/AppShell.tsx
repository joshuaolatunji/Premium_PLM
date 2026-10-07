import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';


function AppShell() {
    // Below the sidebar's own breakpoint (see .sidebar in index.css) it's an
    // off-canvas drawer instead of a permanent column, so this needs to be
    // open/closed from both the hamburger button (Topbar) and the sidebar
    // itself (its backdrop, close button, and nav links).
    const [navOpen, setNavOpen] = useState(false);
    const location = useLocation();

    // Closes the drawer on every navigation, including the back/forward
    // buttons — a link's own onClick (below) doesn't cover those. Compared
    // at render time rather than in an effect (same pattern as Initiatives'
    // URL-query sync) since setting state directly in an effect body is
    // disallowed here.
    const [lastPathname, setLastPathname] = useState(location.pathname);
    if (location.pathname !== lastPathname) {
        setLastPathname(location.pathname);
        setNavOpen(false);
    }

    return (
        <div className="app-shell">
            <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

            <div className="app-shell_main">
                <Topbar onMenuClick={() => setNavOpen(true)} />

                <main className="app-shell_content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default AppShell;
