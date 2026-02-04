import React, { useState } from "react";
import { Link } from "react-router-dom";
import { 
  ChevronLeft, 
  Search, 
  Activity, 
  Check,
  AlertCircle,
  Eye,
  FileText,
  Printer,
  Box,
  Settings,
  Truck,
  ArrowLeft
} from "lucide-react";
import { api, ENDPOINTS } from "../api/config";

// --- TYPES ---
interface TimelineStep {
  label: string;
  status: "completed" | "current" | "pending";
  date: string | null;
  icon: string;
}

interface ActivityLogItem {
  date: string;
  title: string;
  description: string;
}

interface TrackingEquipmentItem {
  nepl_id: string;
  inward_eqp_id: number;
  srf_no: string;
  customer_name: string;
  dc_number: string;
  qty: number;
  current_status: string;
  display_status: string;
  timeline: TimelineStep[];
  activity_log: ActivityLogItem[];
  expected_completion: string | null;
}

interface TrackingResult {
  search_query: string;
  found_via: string;
  equipments: TrackingEquipmentItem[];
}

// --- SUB-COMPONENT: LIST VIEW (IMAGE 1) ---
const ListView: React.FC<{ 
  data: TrackingResult; 
  onViewDetail: (item: TrackingEquipmentItem) => void 
}> = ({ data, onViewDetail }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Search Results</h2>
          <p className="text-sm text-slate-500">Found {data.equipments.length} records via {data.found_via}</p>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-4">SRF NO</th>
              <th className="p-4">NEPL ID</th>
              <th className="p-4">CUSTOMER</th>
              <th className="p-4">DC NUMBER</th>
              <th className="p-4">QTY</th>
              <th className="p-4">STATUS</th>
              <th className="p-4 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.equipments.map((item) => (
              <tr key={item.inward_eqp_id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium text-blue-600">{item.srf_no}</td>
                <td className="p-4 font-bold text-slate-700">{item.nepl_id}</td>
                <td className="p-4 text-slate-600">{item.customer_name}</td>
                <td className="p-4 text-slate-600">{item.dc_number || "-"}</td>
                <td className="p-4">
                   <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{item.qty}</span>
                </td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border
                    ${item.display_status.includes("Completed") ? "bg-green-50 text-green-700 border-green-200" : 
                      item.display_status.includes("Progress") ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-slate-100 text-slate-600 border-slate-200"
                    }
                  `}>
                    {item.display_status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => onViewDetail(item)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {/* Placeholder Actions */}
                    <button className="p-2 text-slate-300 cursor-not-allowed" title="Download Report"><FileText className="h-4 w-4" /></button>
                    <button className="p-2 text-slate-300 cursor-not-allowed" title="Print Label"><Printer className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: DETAIL TIMELINE VIEW (IMAGE 2) ---
const DetailView: React.FC<{ 
  item: TrackingEquipmentItem; 
  onBack: () => void; 
}> = ({ item, onBack }) => {

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'box': return <Box className="h-5 w-5" />;
      case 'file': return <FileText className="h-5 w-5" />;
      case 'settings': return <Settings className="h-5 w-5" />;
      case 'check': return <Check className="h-5 w-5" />;
      case 'truck': return <Truck className="h-5 w-5" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  return (
    <div className="animate-in slide-in-from-right-4 fade-in duration-300">
      {/* Header / Back */}
      <button 
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to List
      </button>

      {/* Main Status Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
               <h2 className="text-2xl font-bold text-slate-900">ORDER #{item.nepl_id}</h2>
               <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded uppercase">
                 {item.display_status}
               </span>
            </div>
            {item.expected_completion && (
               <p className="text-slate-500 text-sm">Expected Completion: {item.expected_completion}</p>
            )}
          </div>
        </div>

        {/* Horizontal Timeline */}
        <div className="relative flex items-center justify-between w-full px-4 md:px-10">
          {/* Connecting Line background */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-0 -translate-y-1/2 rounded-full" />
          
          {/* Active Line (Calculated width roughly) */}
          <div 
             className="absolute top-1/2 left-0 h-1 bg-blue-600 -z-0 -translate-y-1/2 rounded-full transition-all duration-1000"
             style={{ 
               width: `${(item.timeline.filter(s => s.status !== 'pending').length - 1) / (item.timeline.length - 1) * 100}%` 
             }}
          />

          {item.timeline.map((step, idx) => (
            <div key={idx} className="relative z-10 flex flex-col items-center group">
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300
                ${step.status === 'completed' ? 'bg-blue-600 border-blue-600 text-white' : 
                  step.status === 'current' ? 'bg-white border-blue-600 text-blue-600 shadow-lg scale-110' : 
                  'bg-white border-slate-200 text-slate-300'
                }
              `}>
                {step.status === 'completed' ? <Check className="h-6 w-6" /> : getIcon(step.icon)}
              </div>
              <div className="mt-4 text-center">
                <p className={`text-sm font-bold ${step.status === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>
                  {step.label}
                </p>
                {step.date && <p className="text-xs text-slate-500 mt-1">{step.date}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-900">Activity Log</h3>
        </div>

        <div className="relative pl-4 border-l-2 border-slate-100 space-y-8 ml-2">
          {item.activity_log.map((log, idx) => (
            <div key={idx} className="relative pl-6">
              {/* Dot */}
              <div className="absolute -left-[25px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm
                 bg-blue-600 ring-4 ring-blue-50" 
              />
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                <div>
                   <p className="text-sm font-bold text-slate-900">{log.title}</p>
                   <p className="text-sm text-slate-600 mt-0.5">{log.description}</p>
                </div>
                <span className="text-xs font-medium text-slate-400 mt-1 sm:mt-0 whitespace-nowrap">
                  {log.date}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
const TrackStatusPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResult, setSearchResult] = useState<TrackingResult | null>(null);
    const [selectedItem, setSelectedItem] = useState<TrackingEquipmentItem | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoading(true);
        setHasSearched(true);
        setSearchResult(null);
        setSelectedItem(null);
        setErrorMsg(null);

        try {
            const response = await api.get<TrackingResult>(ENDPOINTS.PORTAL.TRACK, {
                params: { query: searchQuery }
            });
            setSearchResult(response.data);
            
            // If only 1 result found via NEPL ID search, show details immediately
            if(response.data.found_via === "NEPL ID" && response.data.equipments.length === 1) {
                setSelectedItem(response.data.equipments[0]);
            }

        } catch (err: any) {
            if (err.response && err.response.status === 404) {
                setErrorMsg(`No records found for "${searchQuery}".`);
            } else {
                setErrorMsg("An error occurred while tracking. Please try again later.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto mt-6 px-4 pb-12">
            {/* Header / Search Card */}
            {!selectedItem && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 mb-8">
                    <div className="bg-blue-600 p-8 relative overflow-hidden">
                        <div className="absolute -top-20 -right-20 w-60 h-60 bg-white opacity-10 rounded-full blur-3xl"></div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                            <div className="flex items-start gap-4">
                                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm border border-white/20">
                                    <Search className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-white mb-1">Track Status</h1>
                                    <p className="text-blue-100 text-sm">Enter NEPL ID or DC Number to track progress.</p>
                                </div>
                            </div>
                            <Link to="/customer" className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur-sm transition text-sm font-medium flex items-center gap-2">
                                <ChevronLeft className="h-4 w-4" /> Dashboard
                            </Link>
                        </div>
                    </div>

                    <div className="p-8">
                        <form onSubmit={handleSearch} className="flex gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                <input 
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="e.g. NEPL26024 or ZKVH/DC-09-380"
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <button 
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-70 flex items-center gap-2"
                            >
                                {loading ? <Activity className="h-5 w-5 animate-spin" /> : "Track"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Content Area */}
            {loading ? (
                <div className="text-center py-20 opacity-50">
                    <Activity className="h-10 w-10 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">Searching records...</p>
                </div>
            ) : selectedItem ? (
                <DetailView item={selectedItem} onBack={() => setSelectedItem(null)} />
            ) : searchResult ? (
                <ListView data={searchResult} onViewDetail={(item) => setSelectedItem(item)} />
            ) : errorMsg ? (
                <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center text-red-600">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                    <p className="font-medium">{errorMsg}</p>
                </div>
            ) : null}
        </div>
    );
};

export default TrackStatusPage;