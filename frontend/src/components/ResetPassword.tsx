// src/components/ResetPassword.tsx
import React, { useState, useEffect, FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, ArrowRight, Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { api, ENDPOINTS } from "../api/config";

// Define an interface for the expected API response shape
interface VerifyTokenResponse {
  valid: boolean;
  email: string;
}

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setError("Invalid reset link");
      setVerifying(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      // Pass the interface as a generic to the api.get call
      const response = await api.get<VerifyTokenResponse>(ENDPOINTS.AUTH.VERIFY_TOKEN(token!));
      if (response.data.valid) {
        setTokenValid(true);
        setUserEmail(response.data.email);
      }
    } catch (err: any) {
      setError("Invalid or expired reset link");
      setTokenValid(false);
    } finally {
      setVerifying(false);
    }
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/(?=.*\d)/.test(password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const passwordError = validatePassword(formData.newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post(ENDPOINTS.AUTH.RESET_PASSWORD, {
        token: token,
        new_password: formData.newPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Invalid Reset Link</h2>
              <p className="mt-2 text-gray-600">
                {error || "This password reset link is invalid or has expired."}
              </p>
              <button
                onClick={() => navigate("/forgot-password")}
                className="mt-6 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Request new reset link
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Password Reset Successful!</h2>
              <p className="mt-2 text-gray-600">
                Your password has been successfully reset.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="mt-6 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go to login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Reset Your Password
            </h2>
            <p className="mt-2 text-gray-600">
              Enter your new password for
            </p>
            <p className="text-sm font-medium text-indigo-600">{userEmail}</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Lock className="h-5 w-5" />
              </span>
              <input
                id="newPassword"
                name="newPassword"
                type={showPassword ? "text" : "password"}
                required
                value={formData.newPassword}
                onChange={(e) => {
                  setFormData({ ...formData, newPassword: e.target.value });
                  setError("");
                }}
                placeholder="New password"
                className="appearance-none block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Lock className="h-5 w-5" />
              </span>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData({ ...formData, confirmPassword: e.target.value });
                  setError("");
                }}
                placeholder="Confirm new password"
                className="appearance-none block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
              <p className="font-semibold mb-1">Password requirements:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>At least 8 characters long</li>
                <li>Contains uppercase and lowercase letters</li>
                <li>Contains at least one number</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !formData.newPassword || !formData.confirmPassword}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <ArrowRight className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200" />
                  </span>
                  Reset Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;