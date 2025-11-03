// src/components/Header.tsx
import React, { useState } from "react";
import { User, LogOut, ChevronDown } from "lucide-react"; 

interface HeaderProps {
  username?: string;
  role?: string; 
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  username = "User",
  role,
  onLogout,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  // Public URL path to your logo
  const logoUrl = "/images/logo.png";

  return (
    <header className="bg-gradient-to-r from-blue-500 to-blue-700 shadow-lg border-b-2 border-blue-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Company Logo"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>

          {/* Right: User info & Profile Dropdown */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2 bg-blue-600 px-4 py-2 rounded-full text-white hover:bg-blue-500 transition-all duration-200"
                aria-expanded={showDropdown}
              >
                <div className="h-8 w-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold truncate max-w-[140px]">
                    {username}
                  </span>
                  {role && (
                    <span className="text-xs font-medium text-gray-200">{role}</span>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    showDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  {onLogout && (
                    <button
                      onClick={() => {
                        onLogout();
                        setShowDropdown(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Logout
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;