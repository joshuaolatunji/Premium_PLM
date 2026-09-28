import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Route-level error boundary. */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  const isResponse = isRouteErrorResponse(error);

  const title = isResponse
    ? `${error.status} ${error.statusText}`
    : "Something went wrong";

  const detail =
    error instanceof Error
      ? error.message
      : "An unexpected error interrupted this page.";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <TriangleAlert aria-hidden="true" className="size-8 text-destructive" />

      <h1 className="text-xl font-semibold">{title}</h1>

      <p className="max-w-prose text-sm text-muted-foreground">{detail}</p>

      <div className="mt-2 flex gap-3">
        <Button onClick={() => navigate(0)}>Try again</Button>
        <Button variant="outline" onClick={() => navigate("/")}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
