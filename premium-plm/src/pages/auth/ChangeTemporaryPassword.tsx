// import { type SubmitEvent, useState } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import LoginLayout from "../../components/auth/LoginLayout";
// import { changeTemporaryPassword } from "../../features/auth/api";

// function ChangeTemporaryPassword() {
//   const navigate = useNavigate();
//   const location = useLocation();

//   const email = location.state?.email ?? "";

//   const [currentPassword, setCurrentPassword] = useState("");
//   const [newPassword, setNewPassword] = useState("");
//   const [confirmPassword, setConfirmPassword] = useState("");

//   const [showCurrentPassword, setShowCurrentPassword] = useState(false);
//   const [showNewPassword, setShowNewPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);

//   const [isLoading, setIsLoading] = useState(false);
//   const [errorMessage, setErrorMessage] = useState("");

//   const [fieldErrors, setFieldErrors] = useState({
//     currentPassword: "",
//     newPassword: "",
//     confirmPassword: "",
//   });

//   function validateForm() {
//     const errors = {
//       currentPassword: "",
//       newPassword: "",
//       confirmPassword: "",
//     };

//     if (!currentPassword.trim()) {
//       errors.currentPassword = "Enter your temporary password.";
//     }

//     if (!newPassword.trim()) {
//       errors.newPassword = "Enter a new password.";
//     } else if (newPassword.length < 8) {
//       errors.newPassword =
//         "Password must be at least 8 characters.";
//     }

//     if (!confirmPassword.trim()) {
//       errors.confirmPassword =
//         "Confirm your new password.";
//     } else if (newPassword !== confirmPassword) {
//       errors.confirmPassword =
//         "Passwords do not match.";
//     }

//     setFieldErrors(errors);

//     return !Object.values(errors).some(Boolean);
//   }

//   async function handleSubmit(
//     event: SubmitEvent<HTMLFormElement>,
//   ) {
//     event.preventDefault();

//     setErrorMessage("");

//     if (!validateForm()) {
//       return;
//     }

//     setIsLoading(true);

//     try {
//       await changeTemporaryPassword({
//         email,
//         currentPassword,
//         newPassword,
//         confirmPassword,
//       });

//       navigate("/login", {
//         state: {
//           passwordChanged: true,
//         },
//       });
//     } catch (error) {
//       if (error instanceof Error) {
//         setErrorMessage(error.message);
//       } else {
//         setErrorMessage(
//           "Unable to change your password. Please try again.",
//         );
//       }
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   return (
//     <LoginLayout>
//       <div className="auth-form">
//         <div className="auth-form-header">
//           <h1>Change your temporary password</h1>

//           <p>
//             For security, you need to create a new password
//             before continuing.
//           </p>
//         </div>

//         {errorMessage && (
//           <p className="form-error" role="alert">
//             {errorMessage}
//           </p>
//         )}

//         <form
//           onSubmit={handleSubmit}
//           noValidate
//         >
//           {/* Current password */}

//           {/* New password */}

//           {/* Confirm password */}

//           <button
//             type="submit"
//             disabled={isLoading}
//           >
//             {isLoading ? "Changing password..." : "Change password"}
//           </button>
//         </form>
//       </div>
//     </LoginLayout>
//   );
// }

// export default ChangeTemporaryPassword;