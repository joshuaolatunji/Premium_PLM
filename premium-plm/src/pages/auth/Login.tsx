import {useState} from "react";
import {Eye, EyeOff} from "lucide-react";

import LoginLayout from "../../components/auth/LoginLayout";

function Login() {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <LoginLayout>
            <div className="login-form">
                <div className="login-form_header">
                    <h2>Sign in to Premium PLM</h2>

                    <p>Use your Premium Trust Bank network credentials.</p>
                </div>

                <form>
                    <div className="form-field">
                        <label htmlFor="email">Email address</label>

                        <input
                            type="email"
                            id="email"
                            placeholder="name@premiumtrustbank.com"
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

                    <button type="submit" className="login-form_submit">
                        Sign in
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
