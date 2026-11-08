import { useState, useEffect, type SubmitEvent } from "react";
import {Eye, EyeOff} from "lucide-react";
import { sileo } from "sileo";
import { Navigate, useNavigate } from "react-router-dom"
import { loginUser } from "../../service/LoginService"
import { getStoredUser, hasValidSession, saveAuthSession } from "../../apicalls/authStorage";
import {checkApiHealth} from "../../service/healthApi"
import { getLandingRouteForRoles } from "../../utils/roleRouting";
import { takeReturnPath, wasSignedOutByExpiry } from "../../utils/sessionReturn";
import { capitalize } from "../../utils/text";

import LoginLayout from "../../components/auth/LoginLayout";

// Everyone signs in with a bank address, so only the part before the @ is typed.
const EMAIL_DOMAIN = "@premiumtrustbank.com";

// The welcome toast lands first; this long after, the page moves on (the
// toast lives at the app root, so it stays up over the dashboard).
const WELCOME_MS = 450;

// Into the app: the sign-in page eases forward and dissolves while the
// dashboard settles in (the "Sign-in transition" CSS, scoped by
// data-transition on <html>). Browsers without view transitions, and anyone
// who prefers reduced motion, simply go straight there.
function enterApp(go: (withTransition: boolean) => void) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supported = "startViewTransition" in document;
    if (reduced || !supported) {
        go(false);
        return;
    }

    const root = document.documentElement;
    root.dataset.transition = "sign-in";
    go(true);
    window.setTimeout(() => delete root.dataset.transition, 1600);
}

function Login() {
    const [showPassword, setShowPassword] = useState(false);
    // Signed out because the session ran out (not a fresh visit).
    const [sessionExpired] = useState(wasSignedOutByExpiry);
    // Already signed in when the page opened. Checked once, so signing in
    // here doesn't jump straight past the "Welcome" moment on the button.
    const [alreadySignedIn] = useState(hasValidSession);

    const navigate = useNavigate();

    // Just "firstname.lastname"; the domain is added when signing in.
    const [emailName, setEmailName] = useState("");
    const emailAddress = `${emailName.trim()}${EMAIL_DOMAIN}`;
    const [password, setPassword] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    // Signed in and on the way out: keeps the button busy until the page changes.
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        void checkApiHealth().catch((error) => {
            console.error("API health check failed:", error);
        });
    }, []);

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();

        setErrorMessage("");
        setIsLoading(true);

        const loginStart = performance.now();

        try{
            const response = await loginUser({
                emailAddress,
                password,
            });

            console.log(
                `Login API response: ${Math.round(
                    performance.now() - loginStart,
                )}ms`,
            )

            if (!response.isSuccessful) {
                setErrorMessage(
                    response.message || "Invalid email address or password.",
                );
                return;
            }

            saveAuthSession(response.data.token, {
                userName: response.data.userName,
                email: response.data.email,
                roles: response.data.roles,
            });

            console.log(
                `Session saved: ${Math.round(
                    performance.now() - loginStart,
                )}ms`,
            );

            console.log(
                `Navigating to dashoard: ${Math.round(
                    performance.now() - loginStart,
                )}ms`,
            );

            // Back to the page they were on if their session had expired
            // (same person only); otherwise their normal landing page. It
            // replaces the login page in the history, so "Back" on that page
            // goes to the page before it, not to login again.
            const destination =
                takeReturnPath(response.data.email ?? emailAddress) ??
                getLandingRouteForRoles(response.data.roles);

            // A green Sileo welcome, then into the app.
            const name = response.data.userName ? capitalize(response.data.userName) : "";
            setLeaving(true);
            sileo.success({
                title: name ? `Welcome back, ${name}` : "Welcome back",
                description: "You're signed in to Premium PLM.",
                fill: "#12805c",
                duration: 3800,
                styles: { title: "sileo-welcome", badge: "sileo-welcome", description: "sileo-welcome" },
            });
            window.setTimeout(
                () => enterApp((viewTransition) => navigate(destination, { replace: true, viewTransition })),
                WELCOME_MS,
            );
        } catch (error) {
            if(error instanceof Error) {
                setErrorMessage(error.message);
            } else {
                setErrorMessage(
                    "Unable to connect to sign in. Please try again.",
                );
            }
        } finally {
            setIsLoading(false);
        }
    }

    // Already signed in (e.g. reached with the browser's back button): no
    // need to sign in again, so straight on to their landing page.
    if (alreadySignedIn) {
        return <Navigate to={getLandingRouteForRoles(getStoredUser()?.roles ?? [])} replace />;
    }

    return (
        <LoginLayout>
            <div className="login-form">
                <div className="login-form_header">
                    <h2>Sign in to Premium PLM</h2>

                    <p>Use your Premium Trust Bank network credentials.</p>
                </div>

                {sessionExpired && (
                    <p className="login-form_notice" role="status">
                        Your session expired. Sign in again to continue where you left off.
                    </p>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <div className="form-field">
                        <label htmlFor="email">Email address</label>

                        <div className="email-input">
                            <input
                                type="text"
                                value={emailName}
                                // A pasted full address keeps only the part before the @.
                                onChange={(event) => setEmailName(event.target.value.split("@")[0])}
                                id="email"
                                name="username"
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder="firstname.lastname"
                                aria-describedby="email-domain"
                                required
                            />

                            <span id="email-domain" className="email-input_domain">
                                {EMAIL_DOMAIN}
                            </span>
                        </div>
                    </div>

                    <div className="form-field">
                        <label htmlFor="password">Password</label>

                        <div className="password-input">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(event => setPassword(event.target.value))}
                                placeholder="••••••••••"
                            />

                            <button
                                type="button"
                                className="password-input_toggle"
                                onClick={() =>
                                    setShowPassword((current) => !current)
                                }
                            >
                                {showPassword ? (
                                    <>
                                        <EyeOff size={13} />
                                        Hide
                                    </>
                                ) : (
                                    <>
                                        <Eye size={13} />
                                        Show
                                    </>
                                )}
                            </button>
                        </div>
                    </div>


                    {errorMessage && (
                        <p className="form-error" role="alert">
                            {errorMessage}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || leaving}
                        className={
                            isLoading || leaving
                                ? "login-form_submit login-form_submit--loading"
                                : "login-form_submit"
                        }
                        aria-live="polite">

                        {isLoading || leaving ? (
                            <span className="login-form_submit-label" key="loading">
                                <span className="login-form_spinner" aria-hidden="true" />
                                Signing in…
                            </span>
                        ) : (
                            "Sign In"
                        )}

                    </button>


                </form>

                {/* <p className="login-form_note">
                    Access is granted by role. If your role or department has
                    changed, contact the Premium PLM administrator.
                </p> */}
            </div>
        </LoginLayout>
    );
}

export default Login;
