import React, { useState, ChangeEvent, FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { User } from "../types"; // Using the centralized User type from src/types/index.ts
import { Mail, Lock, ArrowRight, HelpCircle, Loader2 } from "lucide-react";

// The relative path is now correct because Vite's proxy will handle forwarding it to your backend.
const ENDPOINTS = {
  USERS: {
    LOGIN: '/api/users/login',
  },
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, user, bootstrapped } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // 1. Show a loading spinner until the app has checked for an existing session.
  // This is crucial to prevent the login form from flashing for already logged-in users.
  if (!bootstrapped) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  // 2. If the session check is done and a user exists, redirect them immediately.
  if (user) {
    const path = {
      admin: '/admin',
      engineer: '/engineer',
      customer: '/customer',
    }[user.role] || '/'; // Fallback to root just in case
    return <Navigate to={path} replace />;
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setError("");
    setLoading(true);

    try {
      // 🛑 FIX: Use URLSearchParams to create 'application/x-www-form-urlencoded' data.
      // FastAPI's OAuth2PasswordRequestForm expects this format and expects the email 
      // field to be named 'username'.
      const formData = new URLSearchParams();
      formData.append('username', form.email); // Map frontend 'email' to backend 'username'
      formData.append('password', form.password);

      const res = await fetch(ENDPOINTS.USERS.LOGIN, {
        method: "POST",
        headers: {
          // You can explicitly set this header, but using URLSearchParams in the body
          // often handles it automatically and correctly.
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(), // Send the URL-encoded string
      });

      if (!res.ok) {
        // Try to parse the specific error `detail` from FastAPI.
        const errorData = await res.json().catch(() => ({ detail: "Invalid email or password." }));
        
        // Handle common FastAPI error structure for displaying a clear message
        const errorMessage = errorData.detail 
          ? (Array.isArray(errorData.detail) ? errorData.detail[0].msg : errorData.detail)
          : "Login failed. Please check your credentials.";

        setError(errorMessage);
        setLoading(false);
        return;
      }

      // The response from your backend is the user object directly.
      const userInfo: User = await res.json();
      
      if (!userInfo || !userInfo.user_id) {
          setError("Failed to parse user profile data from response.");
          setLoading(false);
          return;
      }

      setSuccess("Login successful! Redirecting...");
      
      // Update the global state via the AuthProvider.
      login(userInfo);

      // Redirect based on role after a short delay for the success message to be visible.
      setTimeout(() => {
        const path = {
          admin: '/admin',
          engineer: '/engineer',
          customer: '/customer',
        }[userInfo.role] || '/';
        navigate(path, { replace: true });
      }, 500);

    } catch (err) {
      // This catches network errors (e.g., server is down) or fetch API errors.
      setError("A network error occurred. Please try again.");
    } finally {
      // Only stop the loader if an error occurred. On success, the page navigates away,
      // so we don't need to visually stop the loader.
      if (!success) {
        setLoading(false);
      }
    }
  };

  // Your UI is rendered only if the user is not logged in.
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Welcome Back
            </h2>
            <p className="mt-2 text-gray-600">Sign in to your account</p>
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
                value={form.email}
                onChange={handleChange}
                placeholder="Email address"
                className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
              />
            </div>

             <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Lock className="h-5 w-5" />
              </span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="Password"
                className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
              />
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500 transition-colors font-medium"
              >
                <HelpCircle className="w-4 h-4 mr-1" />
                Forgot password?
              </button>
            </div>

            {error && (<div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center"><p className="text-red-800 text-sm">{error}</p></div>)}
            {success && (<div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center"><p className="text-green-800 text-sm">{success}</p></div>)}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <ArrowRight className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200" />
                  </span>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                Sign up here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;