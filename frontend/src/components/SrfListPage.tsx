import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Inbox, ChevronRight, ArrowLeft } from "lucide-react";
import { api, ENDPOINTS } from "../api/config";

interface CreatedInward {
  inward_id: number;
  srf_no: number;
  customer_name: string | null;
  date: string;
}

interface SrfSummary {
  srf_id: number;
  srf_no: number;
  customer_name: string | null;
  date: string;
  status: string | null;
}

interface WorkItem {
  id: number;
  type: "inward" | "srf";
  displayNumber: string;
  customer_name: string | null;
  date: string;
  status: "created" | "inward_completed" | "approved" | "rejected";
}

export const SrfListPage: React.FC = () => {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("created");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [inwardsResponse, srfsResponse] = await Promise.all([
          api.get<CreatedInward[]>(`${ENDPOINTS.STAFF.INWARDS}?status=created`),
          api.get<SrfSummary[]>(`${ENDPOINTS.SRFS}`),
        ]);

        const srfs = srfsResponse.data;
        const inwards = inwardsResponse.data;

        const workItemsList: WorkItem[] = [];

        inwards.forEach((inward) => {
          const relatedSrf = srfs.find((srf) => srf.srf_no === inward.srf_no);

          if (!relatedSrf) {
            workItemsList.push({
              id: inward.inward_id,
              type: "inward",
              displayNumber: `SRF No: ${inward.srf_no}`,
              customer_name: inward.customer_name,
              date: inward.date,
              status: "created",
            });
          } else {
            const status = relatedSrf.status || "created";
            workItemsList.push({
              id: relatedSrf.srf_id,
              type: "srf",
              displayNumber: `SRF No: ${relatedSrf.srf_no}`,
              customer_name: relatedSrf.customer_name,
              date: relatedSrf.date,
              status: status as WorkItem["status"],
            });
          }
        });

        setWorkItems(workItemsList);
      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        setError(
          err.response?.data?.detail ||
            err.message ||
            "Could not load data. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const statuses = ["created", "inward_completed", "approved", "rejected"];

  const groupedWorkItems = workItems.reduce(
    (groups: Record<string, WorkItem[]>, item) => {
      if (!groups[item.status]) groups[item.status] = [];
      groups[item.status].push(item);
      return groups;
    },
    {}
  );

  const statusLabels: Record<string, string> = {
    created: "Pending SRF Creation",
    inward_completed: "Customer Review Pending",
    approved: "Approved",
    rejected: "Rejected",
  };

  const tabColors: Record<string, string> = {
    created: "text-yellow-600 border-yellow-500",
    inward_completed: "text-blue-600 border-blue-500",
    approved: "text-green-600 border-green-500",
    rejected: "text-red-600 border-red-500",
  };

  const currentWorkItems = groupedWorkItems[activeTab] || [];

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center text-gray-600 text-lg">Loading Data...</div>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center text-red-600 bg-white p-6 rounded-xl shadow-md border border-red-200">
          {error}
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-10">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
        {/* Back Button */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate("/engineer")}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8 border-b pb-5">
          <div className="bg-blue-100 p-3 rounded-full">
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">
              SRF Status Overview
            </h1>
            <p className="text-sm text-gray-500">
              View pending and processed SRFs.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-3 border-b border-gray-200 mb-8">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`px-5 py-2.5 font-medium text-sm rounded-t-md border-b-2 transition-all duration-200 ${
                activeTab === status
                  ? `${tabColors[status]} bg-blue-50`
                  : "text-gray-500 border-transparent hover:text-blue-600 hover:bg-gray-50"
              }`}
            >
              {statusLabels[status]}{" "}
              <span className="ml-1 text-gray-400 font-normal">
                ({groupedWorkItems[status]?.length || 0})
              </span>
            </button>
          ))}
        </div>

        {/* Work Items List */}
        <div className="space-y-3">
          {currentWorkItems.length > 0 ? (
            currentWorkItems.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                to={
                  item.type === "inward"
                    ? `/engineer/srfs/new-${item.id}`
                    : `/engineer/srfs/${item.id}`
                }
                className="flex items-center justify-between p-5 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-xl transition-all duration-200 group shadow-sm hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-lg text-gray-800">
                    {item.displayNumber}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {item.customer_name || "N/A"} — Received on{" "}
                    <span className="font-medium text-gray-700">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </Link>
            ))
          ) : (
            <div className="text-center text-gray-500 py-20">
              <Inbox className="h-16 w-16 mx-auto text-gray-400" />
              <h3 className="mt-4 text-lg font-semibold">
                No Items Found
              </h3>
              <p className="text-gray-600">
                There are no items under{" "}
                <span className="font-medium">
                  {statusLabels[activeTab]}
                </span>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SrfListPage;