import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';


function AppShell() {
    return (
        <div className="app-shell">
            <Sidebar />

            <div className="app-shell_main">
                <Topbar />

                <main className="app-shell_content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default AppShell;