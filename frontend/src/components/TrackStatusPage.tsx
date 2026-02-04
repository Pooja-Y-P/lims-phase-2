import React, { useState } from "react";
import { Link } from "react-router-dom";
import { 
  ChevronLeft, 
  Search, 
  Activity, 
  CheckCircle2,
  AlertCircle // Added for error icon
} from "lucide-react";
import { api } from "../api/config"; // Import your API config

// Define response type
interface TrackingResult {
  id: string;
  status: string;
  description: string;
  date: string;
}

const TrackStatusPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResult, setSearchResult] = useState<TrackingResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoading(true);
        setHasSearched(true);
        setSearchResult(null);
        setErrorMsg(null);

        try {
            // Call the real backend API
            const response = await api.get<TrackingResult>('/portal/track', {
                params: { query: searchQuery }
            });
            setSearchResult(response.data);
        } catch (err: any) {
            // Handle 404 (Not Found) specifically
            if (err.response && err.response.status === 404) {
                // Determine if it's a generic 404 or our specific "No records" 404
                setErrorMsg(`No records found for "${searchQuery}". Please check the ID.`);
            } else {
                setErrorMsg("An error occurred while tracking. Please try again.");
                console.error("Tracking error:", err);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto mt-4">
            {/* Main Card */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                {/* Header Section (Blue) */}
                <div className="bg-blue-600 p-8 sm:p-10 relative overflow-hidden">
                    {/* Decorative Circle Overlay */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 right-20 w-20 h-20 bg-white opacity-5 rounded-full blur-xl"></div>

                    {/* Content Wrapper */}
                    <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                        
                        {/* Title & Icon */}
                        <div className="flex items-start gap-5">
                            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm border border-white/20">
                                <Search className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Track Application Status</h1>
                                <p className="text-blue-100 text-sm sm:text-base">Enter NEPL ID (e.g., NEPL26024) or DC Number to check real-time progress.</p>
                            </div>
                        </div>

                        {/* Back Button (Right Aligned & Within Component) */}
                        <Link 
                            to="/customer" 
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg backdrop-blur-sm transition-colors text-sm font-medium whitespace-nowrap"
                        >
                            <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                        </Link>
                    </div>
                </div>

                {/* Body Section */}
                <div className="p-8 sm:p-10">
                    <form onSubmit={handleSearch} className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">
                            NEPL ID or DC Number <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-4 mt-1">
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="e.g. NEPL26024 or ZKVH/DC-09-380"
                                className="flex-1 px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 placeholder-gray-400 transition-all text-base"
                            />
                            <button 
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all flex items-center justify-center gap-2 min-w-[140px]"
                            >
                                {loading ? (
                                    <Activity className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Search className="h-5 w-5" /> Track
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Result Display Section */}
                    {hasSearched && !loading && (
                        <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {searchResult ? (
                                <div className="border border-green-100 bg-green-50 rounded-xl p-6 shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <CheckCircle2 className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                                        <div>
                                            <h3 className="text-lg font-bold text-green-900">Found: {searchResult.id}</h3>
                                            <div className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold mt-1 mb-2 uppercase tracking-wide">
                                                {searchResult.status}
                                            </div>
                                            <p className="text-green-800 font-medium">{searchResult.description}</p>
                                            <p className="text-green-600 text-xs mt-2">Last Updated: {searchResult.date}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : errorMsg ? (
                                <div className="border border-red-100 bg-red-50 rounded-xl p-6 text-center text-red-600 flex flex-col items-center gap-2">
                                    <AlertCircle className="h-8 w-8 text-red-400" />
                                    <p className="font-medium">{errorMsg}</p>
                                    <p className="text-xs text-red-400">Ensure the ID is correct and belongs to your account.</p>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrackStatusPage;