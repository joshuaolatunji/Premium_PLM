interface LoginLayoutProps {
    children: React.ReactNode;
}

function LoginLayout({children}: LoginLayoutProps) {
    return (
        <div className="login-layout">
            <section className="login-layout_brand">
                <div className="login-layout_brand-content">
                    <div className="login-layout_brand-logo">
                        <img src="/premium-logo.png" alt="Premium Trust Bank" />
                    </div>

                    <div className="login-layout_intro">
                        <span className="login-layout_accent" />

                        <h1>
                            Product Lifecycle
                            <br />
                            Management
                        </h1>

                        <p>
                            Governance, approval and audit for every business
                            product initiative across the Bank.
                        </p>
                    </div>

                    <p className="login-layout_legal">
                        Authorised users only. All activity on this platform is
                        recorded and auditable.
                        <br />
                        Technology Support &middot; ext. 4400
                    </p>
                </div>
            </section>

            <section className="login-layout_form">
                {children}
            </section>
        </div>
    );
}

export default LoginLayout;
