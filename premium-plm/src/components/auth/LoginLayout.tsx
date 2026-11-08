import { useEffect, useRef } from "react";

import ThemeToggle from "../common/ThemeToggle";

interface LoginLayoutProps {
    children: React.ReactNode;
}

// The head-office photo behind the sign-in card. It opens close in on the
// PremiumTrust sign and pulls back to the whole building, then drifts very
// slowly (the CSS does both), and leans a few pixels away from the pointer.
// All of it stops for anyone who prefers reduced motion.
function LoginScene() {
    const sceneRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scene = sceneRef.current;
        const finePointer = window.matchMedia("(pointer: fine)").matches;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!scene || !finePointer || reduced) return;

        let frame = 0;

        // -1 to 1 from the centre of the window; CSS eases towards it.
        function lean(event: PointerEvent) {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                scene?.style.setProperty("--lean-x", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
                scene?.style.setProperty("--lean-y", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
            });
        }

        window.addEventListener("pointermove", lean);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("pointermove", lean);
        };
    }, []);

    return (
        <div className="login-scene" ref={sceneRef} aria-hidden="true">
            <div className="login-scene_lean">
                <div className="login-scene_photo" />
            </div>
            <div className="login-scene_wash" />
        </div>
    );
}

// Both logos are rendered and CSS shows the one that suits the theme: the
// white logo in dark mode, the colour logo in light mode.
function LoginLayout({children}: LoginLayoutProps) {
    return (
        <div className="login-layout">
            <LoginScene />

            <header className="login-layout_logo">
                <img
                    className="login-layout_logo-dark"
                    src="/premium-logo-white.png"
                    alt="Premium Trust Bank"
                />
                <img
                    className="login-layout_logo-light"
                    src="/premium-logo.png"
                    alt="Premium Trust Bank"
                />
            </header>

            <ThemeToggle className="login-layout_theme-toggle" />

            <main className="login-layout_form">
                {children}
            </main>

            {/* <p className="login-layout_legal">
                &copy; {new Date().getFullYear()} PremiumTrust Bank &middot; Authorised users only.
                All activity on this platform is recorded and auditable.
            </p> */}
        </div>
    );
}

export default LoginLayout;
