import React, { useState, ChangeEvent, FormEvent } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { User, UserRole } from "../types";
import { Mail, Lock, ArrowRight, HelpCircle, Loader2, Eye, EyeOff } from "lucide-react"; // Added Eye, EyeOff
import { api, ENDPOINTS } from "../api/config";

interface LoginResponse {
  user_id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  token: string;
  customer_id?: number | null;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, bootstrapped } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false); // Added state for password visibility

  if (!bootstrapped) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (user) {
    const path = {
      admin: '/admin',
      engineer: '/engineer',
      customer: '/customer',
    }[user.role] || '/';
    return <Navigate to={path} replace />;
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new URLSearchParams();
      formData.append('username', form.email);
      formData.append('password', form.password);

      const response = await api.post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const loginData = response.data;
      
      const userInfo: User = {
        user_id: loginData.user_id,
        customer_id: loginData.customer_id || null,
        username: loginData.username,
        email: loginData.email,
        full_name: loginData.full_name,
        role: loginData.role as UserRole, 
        token: loginData.token,
        is_active: loginData.is_active,
      };

      setSuccess("Login successful! Redirecting...");
      login(userInfo);

      const params = new URLSearchParams(location.search);
      const redirectPath = params.get('redirect');

      setTimeout(() => {
        if (redirectPath) {
          navigate(redirectPath, { replace: true });
        } else {
          const defaultPath = {
            admin: '/admin',
            engineer: '/engineer',
            customer: '/customer',
          }[userInfo.role] || '/';
          navigate(defaultPath, { replace: true });
        }
      }, 500);

    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || "Login failed. Please check your credentials.";
      setError(errorMessage);
    } finally {
        setLoading(false);
    }
  };

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
                type={showPassword ? "text" : "password"} // Updated to use showPassword state
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="Password"
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

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-green-800 text-sm">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !form.email || !form.password}
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

          {/* Commented out signup section since it's not in your routes yet */}
          {/* <div className="mt-6 text-center">
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
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Login;