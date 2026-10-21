import ThemeToggle from "../common/ThemeToggle";

interface LoginLayoutProps {
    children: React.ReactNode;
}

// Both logos are rendered and CSS shows the one that suits the theme: the
// white logo in dark mode, the colour logo in light mode.
function LoginLayout({children}: LoginLayoutProps) {
    return (
        <div className="login-layout">
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
