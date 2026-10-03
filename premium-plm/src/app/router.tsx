import {createBrowserRouter} from "react-router-dom";
import Login from "../pages/auth/Login";
import DashboardIndex from "../pages/dashboard/DashboardIndex";
import Initiatives from "../pages/initiatives/Initiatives";
import InitiativeDetail from "../pages/initiatives/InitiativeDetail";
import Priorities from "../pages/priorities/Priorities";
import MyWork from "../pages/pm/MyWork";
import BrdHub from "../pages/pm/BrdHub";
import BrdEditor from "../pages/pm/BrdEditor";
import TicketsPage from "../pages/pm/TicketsPage";
import MyTickets from "../pages/pm/MyTickets";
import BrdReviews from "../pages/reviews/BrdReviews";
import BrdReview from "../pages/reviews/BrdReview";
import BdoDocReviews from "../pages/reviews/BdoDocReviews";
import BdoDocReview from "../pages/reviews/BdoDocReview";
import BdoBrdReviews from "../pages/reviews/BdoBrdReviews";
import BdoBrdReview from "../pages/reviews/BdoBrdReview";
import Notifications from "../pages/notifications/Notifications";
import BdoDashboard from "../pages/bdo/BdoDashboard";
import BdoInitiativeWorkspace from "../pages/bdo/BdoInitiativeWorkspace";
import LeadEngineerDashboard from "../pages/leadengineer/LeadEngineerDashboard";
import TicketWorkspace from "../pages/leadengineer/TicketWorkspace";
import DeveloperDashboard from "../pages/developer/DeveloperDashboard";
import DeveloperTicketWorkspace from "../pages/developer/DeveloperTicketWorkspace";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminCategories from "../pages/admin/AdminCategories";
import AuditTrail from "../pages/audit/AuditTrail";
import Profile from "../pages/profile/Profile";
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
                element: <DashboardIndex />,
            },
            {
                path: "initiatives",
                element: <Initiatives />,
            },
            {
                path: "initiatives/:id",
                element: <InitiativeDetail />,
            },
            {
                path: "priorities",
                element: <Priorities />,
            },
            {
                path: "my-work",
                element: <MyWork />,
            },
            {
                path: "brds",
                element: <BrdHub />,
            },
            {
                path: "my-tickets",
                element: <MyTickets />,
            },
            {
                path: "initiatives/:id/brd",
                element: <BrdEditor />,
            },
            {
                path: "initiatives/:id/tickets",
                element: <TicketsPage />,
            },
            {
                path: "brd-reviews",
                element: <BrdReviews />,
            },
            {
                path: "brd-reviews/:id",
                element: <BrdReview />,
            },
            {
                path: "bdo-reviews",
                element: <BdoDocReviews />,
            },
            {
                path: "bdo-reviews/:id",
                element: <BdoDocReview />,
            },
            {
                path: "bdo-brd-reviews",
                element: <BdoBrdReviews />,
            },
            {
                path: "bdo-brd-reviews/:id",
                element: <BdoBrdReview />,
            },
            {
                path: "notifications",
                element: <Notifications />,
            },
            {
                path: "bdo",
                element: <BdoDashboard />,
            },
            {
                path: "bdo/:initiativeId",
                element: <BdoInitiativeWorkspace />,
            },
            {
                path: "lead-engineer",
                element: <LeadEngineerDashboard />,
            },
            {
                path: "lead-engineer/tickets/:ticketId",
                element: <TicketWorkspace />,
            },
            {
                path: "developer",
                element: <DeveloperDashboard />,
            },
            {
                path: "developer/tickets/:ticketId",
                element: <DeveloperTicketWorkspace />,
            },
            {
                path: "admin/users",
                element: <AdminUsers />,
            },
            {
                path: "admin/categories",
                element: <AdminCategories />,
            },
            {
                path: "audit-trail",
                element: <AuditTrail />,
            },
            {
                path: "profile",
                element: <Profile />,
            },
        ],
    },
    // {
    //     path: "/change-temporary-password",
    //     element: <ChangeTemporaryPassword />,
    // }
])

export default router;