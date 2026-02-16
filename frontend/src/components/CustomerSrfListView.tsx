import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Clock,
    CheckCircle2,
    XCircle,
    ChevronLeft,
    FileText,
    ChevronRight,
    Search,
    X,
    Inbox
} from "lucide-react";

interface Srf {
    srf_id: number;
    nepl_srf_no: string;
    status: string;
    date: string;
    created_at?: string;
    inward?: {
        customer_dc_no?: string;
    };
}

const STATUS_KEYS = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
} as const;

type StatusKey = (typeof STATUS_KEYS)[keyof typeof STATUS_KEYS];

interface Props {
    srfs: Srf[];
    loading?: boolean; // Added loading prop
}

// --- Skeleton Component ---
const SrfListSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-10 animate-pulse">
            <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-gray-200">
                
                {/* Header Skeleton */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-gray-200 pb-5">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-gray-200 rounded-full"></div>
                        <div className="space-y-2">
                            <div className="h-8 w-48 bg-gray-300 rounded"></div>
                            <div className="h-4 w-64 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                    <div className="h-10 w-32 bg-gray-200 rounded-lg"></div>
                </div>

                {/* Tabs Skeleton */}
                <div className="flex flex-wrap gap-3 border-b border-gray-200 mb-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 w-32 bg-gray-200 rounded-t-md"></div>
                    ))}
                </div>

                {/* Filters Skeleton */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 h-24">
                    <div className="h-4 w-16 bg-gray-200 rounded mb-2"></div>
                    <div className="h-10 w-full max-w-xs bg-gray-200 rounded-lg"></div>
                </div>

                {/* List Items Skeleton */}
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center justify-between p-5 border border-gray-200 rounded-xl bg-white">
                            <div className="flex items-start gap-4 w-full">
                                {/* Icon Placeholder */}
                                <div className="mt-1 h-10 w-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                                
                                <div className="w-full">
                                    {/* Title & Badge Row */}
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="h-6 w-32 bg-gray-300 rounded"></div>
                                        <div className="h-5 w-24 bg-gray-200 rounded-full"></div>
                                    </div>
                                    {/* Details Row */}
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-20 bg-gray-200 rounded"></div>
                                        <div className="h-4 w-4 bg-gray-200 rounded-full"></div>
                                        <div className="h-4 w-32 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---
const CustomerSrfListView: React.FC<Props> = ({ srfs, loading = false }) => {
    const [activeTab, setActiveTab] = useState<StatusKey>(STATUS_KEYS.PENDING);
    const [searchTerm, setSearchTerm] = useState("");

    // Helper: Categorize SRFs
    const groupedSrfs = useMemo(() => {
        const groups: Record<StatusKey, Srf[]> = {
            [STATUS_KEYS.PENDING]: [],
            [STATUS_KEYS.APPROVED]: [],
            [STATUS_KEYS.REJECTED]: []
        };

        srfs.forEach(srf => {
            const status = srf.status.toLowerCase();
            if (status === 'approved') {
                groups[STATUS_KEYS.APPROVED].push(srf);
            } else if (status === 'rejected') {
                groups[STATUS_KEYS.REJECTED].push(srf);
            } else if (status.includes("inward") || status.includes("pending") || status.includes("reviewed") || status.includes("updated")) {
                groups[STATUS_KEYS.PENDING].push(srf);
            }
        });

        return groups;
    }, [srfs]);

    // Filter Logic
    const filteredSrfs = useMemo(() => {
        let items = groupedSrfs[activeTab] || [];

        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            items = items.filter(item => {
                const searchableText = `${item.nepl_srf_no} ${item.inward?.customer_dc_no || ""}`.toLowerCase();
                return searchableText.includes(searchLower);
            });
        }

        return items;
    }, [groupedSrfs, activeTab, searchTerm]);

    // Helper: Safe date formatter
    const formatDate = (dateString?: string) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? "Invalid Date" : date.toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric"
        });
    };

    const statusLabels: Record<StatusKey, string> = {
        [STATUS_KEYS.PENDING]: "Pending Approval",
        [STATUS_KEYS.APPROVED]: "Approved SRFs",
        [STATUS_KEYS.REJECTED]: "Rejected SRFs",
    };

    const tabColors: Record<StatusKey, string> = {
        [STATUS_KEYS.PENDING]: "text-blue-600 border-blue-500",
        [STATUS_KEYS.APPROVED]: "text-green-600 border-green-500",
        [STATUS_KEYS.REJECTED]: "text-red-600 border-red-500",
    };

    const resetFilters = () => setSearchTerm("");

    // Tab Order
    const tabOrder: StatusKey[] = [STATUS_KEYS.PENDING, STATUS_KEYS.APPROVED, STATUS_KEYS.REJECTED];

    // --- Loading State Check ---
    if (loading) {
        return <SrfListSkeleton />;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-10">
            <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-gray-200">

                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b pb-5">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-100 p-3 rounded-full">
                            <FileText className="h-8 w-8 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800">
                                Service Request Forms
                            </h1>
                            <p className="text-sm text-gray-500">
                                Review pending requests and track approval history.
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/customer"
                        className="flex-shrink-0 flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm transition-colors"
                    >
                        <ChevronLeft size={18} />
                        <span>Back to Dashboard</span>
                    </Link>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-3 border-b border-gray-200 mb-6">
                    {tabOrder.map((status) => (
                        <button
                            key={status}
                            onClick={() => setActiveTab(status)}
                            className={`px-5 py-2.5 font-medium text-sm rounded-t-md border-b-2 transition-all duration-200 ${
                                activeTab === status
                                    ? `${tabColors[status]} bg-gray-50`
                                    : "text-gray-500 border-transparent hover:text-indigo-600 hover:bg-gray-50"
                            }`}
                        >
                            {status === STATUS_KEYS.PENDING && <Clock className="inline-block h-4 w-4 mr-2 mb-0.5" />}
                            {status === STATUS_KEYS.APPROVED && <CheckCircle2 className="inline-block h-4 w-4 mr-2 mb-0.5" />}
                            {status === STATUS_KEYS.REJECTED && <XCircle className="inline-block h-4 w-4 mr-2 mb-0.5" />}
                            {statusLabels[status]}
                            <span className="ml-1 text-gray-400 font-normal">
                                ({groupedSrfs[status]?.length || 0})
                            </span>
                        </button>
                    ))}
                </div>

                {/* Filters Section */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex flex-wrap items-end gap-4">
                        {/* Search Filter */}
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Search
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by SRF No or DC No..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                                />
                            </div>
                        </div>

                        {/* Clear Button */}
                        {searchTerm && (
                            <button
                                onClick={resetFilters}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2 transition-colors"
                            >
                                <X className="h-4 w-4" />
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Filter Summary */}
                    {searchTerm && (
                        <div className="mt-3 text-sm text-gray-600">
                            Showing {filteredSrfs.length} of {groupedSrfs[activeTab].length} items matching "{searchTerm}"
                        </div>
                    )}
                </div>

                {/* List View */}
                <div className="space-y-3">
                    {filteredSrfs.length > 0 ? (
                        filteredSrfs.map((srf) => (
                            <Link
                                key={srf.srf_id}
                                to={`/customer/srfs/${srf.srf_id}`}
                                className="flex items-center justify-between p-5 bg-gray-50 hover:bg-indigo-50 border border-gray-200 rounded-xl transition-all duration-200 group shadow-sm hover:shadow-md"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="mt-1">
                                        {activeTab === STATUS_KEYS.PENDING && <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Clock size={20} /></div>}
                                        {activeTab === STATUS_KEYS.APPROVED && <div className="bg-green-100 p-2 rounded-full text-green-600"><CheckCircle2 size={20} /></div>}
                                        {activeTab === STATUS_KEYS.REJECTED && <div className="bg-red-100 p-2 rounded-full text-red-600"><XCircle size={20} /></div>}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-3">
                                            <p className="font-semibold text-lg text-gray-800">
                                                {srf.nepl_srf_no}
                                            </p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize
                                                ${activeTab === STATUS_KEYS.PENDING ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                                ${activeTab === STATUS_KEYS.APPROVED ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                                ${activeTab === STATUS_KEYS.REJECTED ? 'bg-red-50 text-red-700 border-red-200' : ''}
                                            `}>
                                                {srf.status.replace(/_/g, " ")}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">
                                            DC No: <span className="font-medium text-gray-800">{srf.inward?.customer_dc_no || "N/A"}</span>
                                            <span className="mx-2 text-gray-300">|</span>
                                            Received on <span className="font-medium text-gray-700">{formatDate(srf.date || srf.created_at)}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center text-sm font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {activeTab === STATUS_KEYS.PENDING ? "Review" : "View Details"}
                                    <ChevronRight className="h-5 w-5 ml-1" />
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="text-center text-gray-500 py-20">
                            <Inbox className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700">No Items Found</h3>
                            <p className="text-gray-500 mt-1">
                                There are no {statusLabels[activeTab].toLowerCase()} at the moment.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerSrfListView;