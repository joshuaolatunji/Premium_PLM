import { useState, type SubmitEvent } from "react";
import {Eye, EyeOff} from "lucide-react";
import { useNavigate } from "react-router-dom"
import { loginUser } from "../../features/auth/api"
import { saveAuthSession } from "../../services/authStorage"

import LoginLayout from "../../components/auth/LoginLayout";

function Login() {
    const [showPassword, setShowPassword] = useState(false);

    const navigate = useNavigate();

    const [emailAddress, setEmailAddress] = useState("");
    const [password, setPassword] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

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

            navigate("/");
        } catch (error) {
            if(error instanceof Error) {
                setErrorMessage(error.message);
            } else {
                setErrorMessage(
                    "Unable to connect to the server. Please try again.",
                );
            }
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <LoginLayout>
            <div className="login-form">
                <div className="login-form_header">
                    <h2>Sign in to Premium PLM</h2>

                    <p>Use your Premium Trust Bank network credentials.</p>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <div className="form-field">
                        <label htmlFor="email">Email address</label>

                        <input
                            type="email"
                            value={emailAddress}
                            onChange={(event) => setEmailAddress(event.target.value)}
                            id="email"
                            placeholder="name@premiumtrustbank.com"
                            required
                        />
                    </div>

                    <div className="form-field">
                        <div className="form-field_label-row">
                            <label htmlFor="password">Password</label>

                            <button type="button" className="forgot-password">
                                Forgot password?
                            </button>
                        </div>

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
                        disabled={isLoading}
                        className="login-form_submit">

                        {isLoading ? "Signing in..." : "Sign In"}

                    </button>


                </form>

                <p className="login-form_note">
                    Access is granted by role. If your role or department has
                    changed, contact the Premium PLM administrator.
                </p>
            </div>
        </LoginLayout>
    );
}

export default Login;
