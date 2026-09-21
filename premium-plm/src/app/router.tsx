import {createBrowserRouter} from "react-router-dom";
import Login from "../pages/auth/Login";
import Dashboard from "../pages/dashboard/Dashboard";
import AppShell from "../components/layout/AppShell";
// import ChangeTemporaryPassword from "../pages/auth/ChangeTemporaryPassword"

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
    },
    // {
    //     path: "/change-temporary-password",
    //     element: <ChangeTemporaryPassword />,
    // }
])

export default router;