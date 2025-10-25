// src/components/ForgotPassword.tsx
import React, { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, ArrowLeft, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { api, ENDPOINTS } from "../api/config";

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
              <p className="mt-2 text-gray-600">
                We've sent password reset instructions to {email}
              </p>
              <p className="mt-4 text-sm text-gray-500">
                Didn't receive the email? Check your spam folder or try again in a few minutes.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="mt-6 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
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
              Forgot Password?
            </h2>
            <p className="mt-2 text-gray-600">
              Enter your email and we'll send you reset instructions
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Mail className="h-5 w-5" />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="Enter your email address"
                className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <ArrowRight className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200" />
                  </span>
                  Send Reset Instructions
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500 transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;