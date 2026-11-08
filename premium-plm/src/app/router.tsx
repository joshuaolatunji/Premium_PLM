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
import ExecutiveDashboard from "../pages/executive/ExecutiveDashboard";
import MyApprovals from "../pages/approvals/MyApprovals";
import ApprovalSign from "../pages/approvals/ApprovalSign";
import SignOffs from "../pages/approvals/SignOffs";
import Memos from "../pages/memos/Memos";
import MemoPage from "../pages/memos/MemoPage";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminNewUser from "../pages/admin/AdminNewUser";
import AdminCategories from "../pages/admin/AdminCategories";
import AuditTrail from "../pages/audit/AuditTrail";
import Profile from "../pages/profile/Profile";
import AppShell from "../components/layout/AppShell";
import {Navigate} from "react-router-dom"
import type {ReactNode} from "react";
import {FOCUS_HOME, SHOW_DOCUMENTS, SHOW_ENGINEERING, SHOW_INITIATIVE_CORE, SHOW_OVERSIGHT} from "../config/features";
// import ChangeTemporaryPassword from "../pages/auth/ChangeTemporaryPassword"

// const loginRoute = {element: <Login />}

// A page from one of the initiative phases (config/features.ts). While its
// phase is off, its address sends people to the memo dashboard instead.
function inPhase(on: boolean, page: ReactNode) {
    return on ? page : <Navigate to={FOCUS_HOME} replace />;
}

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
                element: inPhase(SHOW_INITIATIVE_CORE, <Initiatives />),
            },
            {
                // Static "new" segment outranks the ":id" route below.
                path: "initiatives/new",
                element: inPhase(SHOW_INITIATIVE_CORE, <CreateInitiative />),
            },
            {
                path: "initiatives/:id",
                element: inPhase(SHOW_INITIATIVE_CORE, <InitiativeDetail />),
            },
            {
                path: "priorities",
                element: inPhase(SHOW_INITIATIVE_CORE, <Priorities />),
            },
            {
                path: "my-work",
                element: inPhase(SHOW_INITIATIVE_CORE, <MyWork />),
            },
            {
                path: "my-tickets",
                element: inPhase(SHOW_ENGINEERING, <MyTickets />),
            },
            {
                path: "initiatives/:id/tickets",
                element: inPhase(SHOW_ENGINEERING, <TicketsPage />),
            },
            {
                path: "bdo-reviews",
                element: inPhase(SHOW_DOCUMENTS, <BdoDocReviews />),
            },
            {
                path: "bdo-reviews/:id",
                element: inPhase(SHOW_DOCUMENTS, <BdoDocReview />),
            },
            // PID / FRD / BRD / SWR — one set of pages for all four.
            {
                path: "documents/:docType",
                element: inPhase(SHOW_DOCUMENTS, <DocumentHub />),
            },
            {
                path: "initiatives/:id/documents/:docType",
                element: inPhase(SHOW_DOCUMENTS, <DocumentEditor />),
            },
            {
                path: "document-reviews/:docType",
                element: inPhase(SHOW_DOCUMENTS, <DocumentReviews reviewer="GroupHead" />),
            },
            {
                path: "document-reviews/:docType/:id",
                element: inPhase(SHOW_DOCUMENTS, <DocumentReview reviewer="GroupHead" />),
            },
            {
                path: "bdo-document-reviews/:docType",
                element: inPhase(SHOW_DOCUMENTS, <DocumentReviews reviewer="BDO" />),
            },
            {
                path: "bdo-document-reviews/:docType/:id",
                element: inPhase(SHOW_DOCUMENTS, <DocumentReview reviewer="BDO" />),
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
                element: inPhase(SHOW_DOCUMENTS, <BdoDashboard />),
            },
            {
                path: "bdo/:initiativeId",
                element: inPhase(SHOW_DOCUMENTS, <BdoInitiativeWorkspace />),
            },
            {
                path: "lead-engineer",
                element: inPhase(SHOW_ENGINEERING, <LeadEngineerDashboard />),
            },
            {
                path: "lead-engineer/tickets/:ticketId",
                element: inPhase(SHOW_ENGINEERING, <TicketWorkspace />),
            },
            {
                path: "developer",
                element: inPhase(SHOW_ENGINEERING, <DeveloperDashboard />),
            },
            {
                path: "developer/tasks/:taskId",
                element: inPhase(SHOW_ENGINEERING, <DeveloperTicketWorkspace />),
            },
            // Old ticket-based addresses — developers now work per task.
            {
                path: "developer/tickets/:ticketId",
                element: <Navigate to="/dashboard/developer" replace />,
            },
            {
                path: "executive",
                element: inPhase(SHOW_OVERSIGHT, <ExecutiveDashboard />),
            },
            // Sign-off: anyone a Product Manager picks as an approver.
            {
                path: "approvals",
                element: inPhase(SHOW_DOCUMENTS, <MyApprovals />),
            },
            {
                path: "approvals/:workflowId/:stepId",
                element: inPhase(SHOW_DOCUMENTS, <ApprovalSign />),
            },
            {
                // Every sign-off workflow, filterable (PM and Group Head).
                path: "sign-offs",
                element: inPhase(SHOW_DOCUMENTS, <SignOffs />),
            },
            {
                // Every user: standalone memos, and memos on initiatives.
                path: "memos",
                element: <Memos />,
            },
            {
                // Static "new" segment outranks ":memoId".
                path: "memos/new",
                element: <MemoPage />,
            },
            {
                path: "memos/:memoId",
                element: <MemoPage />,
            },
            {
                path: "admin/users",
                element: <AdminUsers />,
            },
            {
                path: "admin/users/new",
                element: <AdminNewUser />,
            },
            {
                path: "admin/categories",
                element: inPhase(SHOW_OVERSIGHT, <AdminCategories />),
            },
            {
                path: "audit-trail",
                element: inPhase(SHOW_OVERSIGHT, <AuditTrail />),
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