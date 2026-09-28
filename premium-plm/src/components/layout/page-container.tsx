import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="mx-auto w-full max-w-[1600px] min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-9">
      {children}
    </div>
  );
}
