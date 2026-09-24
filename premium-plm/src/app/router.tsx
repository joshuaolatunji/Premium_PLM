import {createBrowserRouter} from "react-router-dom";
import Login from "../pages/auth/Login";
import Dashboard from "../pages/dashboard/Dashboard";
import AppShell from "../components/layout/AppShell";
import {Navigate} from "react-router-dom"
// import ChangeTemporaryPassword from "../pages/auth/ChangeTemporaryPassword"

// const loginRoute = {element: <Login />}

const router = createBrowserRouter([
    {
        path: "/", 
        element: <Navigate to="/login" replace />
    },

    {
        path: "/login",
        element: <Login />
    },

    {
        path: "/dashboard",
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