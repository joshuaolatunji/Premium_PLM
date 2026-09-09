import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface AppShellProps {
    children: React.ReactNode;
}

function AppShell({ children }: AppShellProps) {
    return (
        <div className="app-shell">
            <Sidebar />

            <div className="app-shell_main">
                <Topbar />

                <main className="app-shell_content">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default AppShell;