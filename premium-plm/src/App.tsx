import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import "@/app/api-client";

export default function App() {
  return <RouterProvider router={router} />;
}
