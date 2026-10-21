import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { clearAuthSession, getSessionExpiry, hasValidSession } from '../../apicalls/authStorage';

// Every /dashboard page renders inside AppShell, so it's the one place the
// session gets checked for all of them. This is the outer guard: no valid
// session → straight to login, before any page mounts or fetches anything.
// It re-runs on every render, including each navigation and a full page
// refresh, so an expired session can't reach any dashboard page.
function AppShell() {
    if (!hasValidSession()) {
        clearAuthSession();
        return <Navigate to="/login" replace />;
    }

    return <AuthenticatedShell />;
}

function AuthenticatedShell() {
    const navigate = useNavigate();

    // Signs the user out at the exact moment the token expires, even if
    // they're idle on a page and never click anything. One timer, scheduled
    // for the expiry instant (read once — it can't change without a new
    // login, which remounts this shell).
    useEffect(() => {
        const expiry = getSessionExpiry();

        if (expiry === null) {
            return;
        }

        const timeoutId = setTimeout(() => {
            clearAuthSession();
            navigate('/login', { replace: true });
        }, Math.max(0, expiry - Date.now()));

        return () => clearTimeout(timeoutId);
    }, [navigate]);

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
