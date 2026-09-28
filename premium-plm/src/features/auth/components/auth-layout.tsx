import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-hidden lg:grid lg:grid-cols-[43%_57%]">
      {/* Brand panel: desktop only, so the mobile logo lives with the form. */}
      <section className="hidden bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex min-h-dvh w-full flex-col p-12">
          <div className="flex h-fit w-fit items-center rounded-lg bg-white px-4 py-3">
            <img
              src="/premium-logo.png"
              alt="Premium Trust Bank"
              className="block h-8 w-auto"
            />
          </div>

          <div className="my-auto max-w-[420px]">
            <span className="mb-6 block h-[3px] w-16 bg-brand" />

            <h1 className="text-[2.75rem] leading-[1.12] font-semibold tracking-[-0.02em]">
              Product Lifecycle
              <br />
              Management
            </h1>

            <p className="mt-5 max-w-[340px] text-sm leading-relaxed text-white/55">
              Governance, approval and audit for every business product
              initiative across the Bank.
            </p>
          </div>

          <p className="text-[0.6875rem] leading-relaxed text-white/35">
            Authorised users only. All activity on this platform is recorded and
            auditable.
            <br />
            Technology Support &middot; ext. 4400
          </p>
        </div>
      </section>

      {/*
        Single centred column below lg. `py` plus `min-h-dvh` lets the card grow
        when the mobile keyboard shrinks the viewport, so the focused field
        never gets clipped.
      */}
      <section className="flex min-h-dvh items-center justify-center bg-sidebar p-4 sm:p-8 lg:bg-background lg:p-10">
        <div className="w-full max-w-[500px] rounded-xl bg-card p-5 shadow-modal sm:p-9">
          {children}
        </div>
      </section>
    </div>
  );
}
