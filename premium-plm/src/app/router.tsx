import {createBrowserRouter} from "react-router-dom";
import Login from "../pages/auth/Login";
import Dashboard from "../pages/dashboard/Dashboard";
import AppShell from "../components/layout/AppShell";

const router = createBrowserRouter([
    {
        path: "/login",
        element: <Login />
    },
    {
        path: "/",
        element: <AppShell />,
        children: [
            {
                index: true,
                element: <Dashboard />,
            },
        ],
    }
])

export default router;