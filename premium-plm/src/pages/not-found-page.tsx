import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div className="flex flex-col items-start gap-4 py-16">
        <p className="font-mono text-sm text-muted-foreground">404</p>

        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>

        <p className="max-w-prose text-sm text-muted-foreground">
          This page does not exist, or you may not have access to it. The
          navigation on the left lists everything available to you.
        </p>

        <Button onClick={() => navigate("/")}>Back to dashboard</Button>
      </div>
    </PageContainer>
  );
}
