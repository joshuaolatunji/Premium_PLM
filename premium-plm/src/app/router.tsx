import {createBrowserRouter} from "react-router-dom";
import Login from "../pages/auth/Login";
import DashboardIndex from "../pages/dashboard/DashboardIndex";
import Initiatives from "../pages/initiatives/Initiatives";
import InitiativeDetail from "../pages/initiatives/InitiativeDetail";
import CreateInitiative from "../pages/initiatives/CreateInitiative";
import Priorities from "../pages/priorities/Priorities";
import MyWork from "../pages/pm/MyWork";
import TicketsPage from "../pages/pm/TicketsPage";
import MyTickets from "../pages/pm/MyTickets";
import BdoDocReviews from "../pages/reviews/BdoDocReviews";
import BdoDocReview from "../pages/reviews/BdoDocReview";
import DocumentHub from "../pages/documents/DocumentHub";
import DocumentEditor from "../pages/documents/DocumentEditor";
import DocumentReviews from "../pages/documents/DocumentReviews";
import DocumentReview from "../pages/documents/DocumentReview";
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
                // Static "new" segment outranks the ":id" route below.
                path: "initiatives/new",
                element: <CreateInitiative />,
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
                path: "my-tickets",
                element: <MyTickets />,
            },
            {
                path: "initiatives/:id/tickets",
                element: <TicketsPage />,
            },
            {
                path: "bdo-reviews",
                element: <BdoDocReviews />,
            },
            {
                path: "bdo-reviews/:id",
                element: <BdoDocReview />,
            },
            // PID / FRD / BRD / SWR — one set of pages for all four.
            {
                path: "documents/:docType",
                element: <DocumentHub />,
            },
            {
                path: "initiatives/:id/documents/:docType",
                element: <DocumentEditor />,
            },
            {
                path: "document-reviews/:docType",
                element: <DocumentReviews reviewer="GroupHead" />,
            },
            {
                path: "document-reviews/:docType/:id",
                element: <DocumentReview reviewer="GroupHead" />,
            },
            {
                path: "bdo-document-reviews/:docType",
                element: <DocumentReviews reviewer="BDO" />,
            },
            {
                path: "bdo-document-reviews/:docType/:id",
                element: <DocumentReview reviewer="BDO" />,
            },
            // Old BRD addresses (bookmarks) → the new BRD pages.
            {
                path: "brds",
                element: <Navigate to="/dashboard/documents/brd" replace />,
            },
            {
                path: "brd-reviews",
                element: <Navigate to="/dashboard/document-reviews/brd" replace />,
            },
            {
                path: "bdo-brd-reviews",
                element: <Navigate to="/dashboard/bdo-document-reviews/brd" replace />,
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