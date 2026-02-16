import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom"; 
import { api } from "../api/config";
import {
  ArrowLeft,
  Calculator,
  AlertTriangle,
  Info,
  Table as TableIcon,
  Plus,
  Minus,
} from "lucide-react";

// --- Interfaces matching Backend Schema ---
interface UncertaintyBudget {
  id: number;
  job_id: number;
  step_percent: number;
  set_torque_ts: number;
  
  // Individual components
  delta_s_un: number;
  delta_p: number;
  wmd: number;
  wr: number;
  wrep: number;
  wod: number;
  wint: number;
  wl: number;
  wre: number;

  // Final results
  combined_uncertainty: number;
  effective_dof: number; 
  coverage_factor: number;
  expanded_uncertainty: number;
  expanded_un_nm: number | null;

  // Error & Decision
  mean_measurement_error: number;
  max_device_error: number;
  
  // CMC Fields
  cmc: number;
  cmc_absolute?: number;
  cmc_of_reading: number;

  final_wl: number;
  
  created_at: string;
}

// --- Skeleton Component ---
const UncertaintyBudgetSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans animate-pulse">
      <div className="max-w-[100rem] mx-auto space-y-6">
        
        {/* Header Skeleton */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-gray-300 rounded"></div>
              <div className="h-8 w-64 bg-gray-300 rounded"></div>
            </div>
            <div className="h-4 w-48 bg-gray-200 rounded"></div>
          </div>
          <div className="h-10 w-32 bg-gray-200 rounded-lg"></div>
        </div>

        {/* Table Container Skeleton */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
          {/* Table Toolbar */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-gray-300 rounded"></div>
              <div className="h-5 w-40 bg-gray-300 rounded"></div>
            </div>
            {/* Decimal Control Skeleton */}
            <div className="h-8 w-24 bg-gray-200 rounded-lg"></div>
          </div>

          {/* Table Grid Skeleton */}
          <div className="overflow-x-auto p-2">
            <div className="min-w-[1000px]">
              {/* Fake Headers (3 rows) */}
              <div className="flex gap-1 mb-1">
                {[...Array(15)].map((_, i) => (
                  <div key={`h1-${i}`} className="h-8 bg-gray-200 rounded flex-1"></div>
                ))}
              </div>
              <div className="flex gap-1 mb-1">
                {[...Array(15)].map((_, i) => (
                  <div key={`h2-${i}`} className="h-8 bg-gray-200 rounded flex-1"></div>
                ))}
              </div>
              <div className="flex gap-1 mb-2">
                {[...Array(15)].map((_, i) => (
                  <div key={`h3-${i}`} className="h-8 bg-gray-200 rounded flex-1"></div>
                ))}
              </div>

              {/* Fake Data Rows */}
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="flex gap-1 mb-2">
                  {[...Array(21)].map((col) => (
                    <div 
                      key={col} 
                      className={`h-10 bg-gray-100 rounded border border-gray-100 ${col === 0 ? 'bg-gray-200 w-24 flex-shrink-0' : 'flex-1'}`}
                    ></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
const UncertaintyBudgetPage: React.FC = () => {
  const { inwardId, equipmentId } = useParams<{ inwardId: string; equipmentId: string }>();
  const navigate = useNavigate();
  const location = useLocation(); 

  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<UncertaintyBudget[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- Decimal Places (Default 4) ---
  const [decimalPlaces, setDecimalPlaces] = useState<number>(4);

  useEffect(() => {
    if (equipmentId) {
      fetchBudget();
    } else {
      setError("Invalid Equipment ID");
      setLoading(false);
    }
  }, [equipmentId]);

  const fetchBudget = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get<UncertaintyBudget[]>(`/uncertainty/budget`, {
        params: { inward_eqp_id: equipmentId }
      });
      
      if (response.data && response.data.length > 0) {
        const sorted = response.data.sort((a, b) => a.step_percent - b.step_percent);
        setBudgets(sorted);
      } else {
        setError("No budget data found.");
      }
      
    } catch (err: any) {
      console.error("Failed to fetch budget", err);
      if (err.response?.status === 404) {
        setError("Uncertainty budget not found. It may not have been calculated yet.");
      } else {
        setError(err.message || "Failed to load uncertainty budget data.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- UPDATED: Handle Back to maintain correct Tab ---
  const handleBack = () => {
    // 1. Get the tab we came from
    const sourceTab = (location.state as any)?.activeTab;

    // 2. Navigate back passing the tab
    navigate("/engineer/jobs", { 
        state: { 
            viewJobId: Number(inwardId),
            // Use the source tab (e.g., 'terminated' or 'completed'). 
            // If undefined, let Jobs page decide (usually defaults to pending/in_progress).
            activeTab: sourceTab 
        } 
    });
  };

  // --- FORMATTER FUNCTION ---
  const fmt = (num: number | null | undefined, overrideDecimals?: number) => {
    if (num === undefined || num === null || isNaN(num)) return "-";
    const decimalsToUse = overrideDecimals !== undefined ? overrideDecimals : decimalPlaces;
    return Number(num).toFixed(decimalsToUse);
  };

  // --- Handlers for Decimal Control ---
  const increaseDecimals = () => setDecimalPlaces((prev) => Math.min(prev + 1, 8));
  const decreaseDecimals = () => setDecimalPlaces((prev) => Math.max(prev - 1, 0));

  // --- Render States ---
  if (loading) {
    return <UncertaintyBudgetSkeleton />;
  }

  if (error || budgets.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm max-w-lg w-full">
          <div className="inline-flex p-4 bg-orange-50 rounded-full mb-4">
            {error ? <AlertTriangle className="h-10 w-10 text-red-500" /> : <Info className="h-10 w-10 text-orange-500" />}
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{error ? "Unable to Load Data" : "No Data"}</h3>
          <p className="text-gray-500 mb-6">{error || "No uncertainty budget steps returned."}</p>
          <button 
            onClick={handleBack}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Styles
  const headerCellClass = "border border-gray-400 px-2 py-2 text-center text-xs font-bold text-gray-800 bg-[#e0f2f1]"; 
  const symbolCellClass = "border border-gray-400 px-2 py-1 text-center text-sm font-serif font-bold text-gray-900 bg-[#e0f2f1]";
  const unitCellClass = "border border-gray-400 px-2 py-1 text-center text-xs font-bold text-gray-700 bg-[#e0f2f1]";
  const bodyCellClass = "border border-gray-300 px-2 py-2 text-center text-sm text-gray-700";

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      <div className="max-w-[100rem] mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Calculator className="h-5 w-5" />
              <span className="text-2xl font-bold text-blue-900"><h1>Uncertainty Budget Report</h1></span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              <span className="font-semibold">Inward ID:</span> {inwardId} <span className="mx-2 text-gray-300">|</span> 
              <span className="font-semibold">Equipment ID:</span> {equipmentId}
            </p>
          </div>
          <button onClick={handleBack} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors border border-gray-200 shadow-sm">
            <ArrowLeft className="h-4 w-4" /> Back to Job
          </button>
        </div>

        {/* --- DETAILED TABLE --- */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TableIcon className="h-5 w-5 text-gray-500" />
                    <h3 className="font-bold text-gray-800">ISO 6789 Uncertainty Budget</h3>
                </div>

                {/* --- DECIMAL CONTROLS --- */}
                <div className="flex items-center gap-3 bg-white border border-gray-200 p-1.5 rounded-lg shadow-sm">
                    <span className="text-xs font-bold text-gray-500 uppercase px-1">Decimals</span>
                    <div className="flex items-center bg-gray-100 rounded-md">
                        <button 
                            onClick={decreaseDecimals}
                            className="p-1.5 hover:bg-gray-200 text-gray-600 rounded-l-md transition-colors border-r border-gray-300"
                            title="Decrease Decimal"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-blue-600">
                            {decimalPlaces}
                        </span>
                        <button 
                            onClick={increaseDecimals}
                            className="p-1.5 hover:bg-gray-200 text-gray-600 rounded-r-md transition-colors border-l border-gray-300"
                            title="Increase Decimal"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

            </div>
            
            <div className="overflow-x-auto p-2">
                <table className="w-full border-collapse border border-gray-400">
                    <thead>
                        {/* --- ROW 1: Descriptions --- */}
                        <tr>
                            <th className={headerCellClass} style={{ minWidth: '80px' }}>Set Torque (DUC)</th>
                            <th className={headerCellClass}>Uncertainty of pressure gauge</th>
                            <th className={headerCellClass}>Resolution of input pressure</th>
                            <th className={headerCellClass}>Standard</th>
                            <th className={headerCellClass}>Resolution</th>
                            <th className={headerCellClass}>Reproducibility</th>
                            <th className={headerCellClass}>Output drive</th>
                            <th className={headerCellClass}>Interface</th>
                            <th className={headerCellClass}>Loading Point</th>
                            
                            <th className={`${headerCellClass} p-0 align-top`}>
                                <div className="border-b border-gray-400 py-1 bg-[#e0f2f1]">Type A</div>
                                <div className="py-1 bg-[#e0f2f1]">Repeatability</div>
                            </th>
                            
                            <th className={headerCellClass}>Combined Uncertainty</th>
                            {/* NEW COLUMN DESCRIPTION */}
                            <th className={headerCellClass}>Effective Degree of Freedom</th>
                            <th className={headerCellClass}>Coverage factor</th>
                            
                            <th className={headerCellClass}>Expanded Uncertainty</th>
                            <th className={headerCellClass}>Expanded Uncertainty</th>
                            <th className={headerCellClass} style={{ maxWidth: '100px' }}>Mean Value of error</th>
                            <th className={headerCellClass} style={{ maxWidth: '100px' }}>Max value of error</th>
                            
                            <th className={headerCellClass}>Calibration Capability</th>
                            <th className={headerCellClass}>CMC Absolute</th>
                            <th className={headerCellClass}>CMC of Reading</th>

                            <th className={headerCellClass}>S</th>
                        </tr>

                        {/* --- ROW 2: Symbols --- */}
                        <tr>
                            <th className={symbolCellClass}>Ts</th>
                            <th className={symbolCellClass}>δS un</th>
                            <th className={symbolCellClass}>δP Resolution</th>
                            <th className={symbolCellClass}>Wmd</th>
                            <th className={symbolCellClass}>Wr</th>
                            <th className={symbolCellClass}>Wrep</th>
                            <th className={symbolCellClass}>Wod</th>
                            <th className={symbolCellClass}>Wint</th>
                            <th className={symbolCellClass}>Wl</th>
                            <th className={symbolCellClass}>brep</th>
                            <th className={symbolCellClass}>W</th>
                            {/* NEW COLUMN SYMBOL */}
                            <th className={symbolCellClass}>Veff</th>
                            <th className={symbolCellClass}>k</th>
                            
                            <th className={symbolCellClass}>%</th>
                            <th className={symbolCellClass}>U</th>
                            <th className={symbolCellClass}>|ās|</th>
                            <th className={symbolCellClass}>|bep|</th>
                            
                            <th className={symbolCellClass}>CMC</th>
                            <th className={symbolCellClass}>CMC (abs)</th>
                            <th className={symbolCellClass}>CMC (rdg)</th>

                            <th className={symbolCellClass}>Final (Wl)</th>
                        </tr>

                        {/* --- ROW 3: Units --- */}
                        <tr>
                            <th className={unitCellClass}>Nm</th>
                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>%</th>
                            {/* NEW COLUMN UNIT (Empty) */}
                            <th className={unitCellClass}></th>
                            <th className={unitCellClass}></th>
                            
                            <th className={unitCellClass}></th> 
                            <th className={unitCellClass}>Nm</th>
                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>%</th>

                            <th className={unitCellClass}>%</th>
                            <th className={unitCellClass}>Nm</th>
                            <th className={unitCellClass}>%</th>

                            <th className={unitCellClass}>%</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200">
                        {budgets.map((row) => {
                            const cmcAbs = Math.abs(row.cmc);
                            return (
                                <tr key={row.id}>
                                    <td className={`${bodyCellClass} font-bold text-gray-900 bg-gray-50`}>
                                        {fmt(row.set_torque_ts, 2)} 
                                    </td>
                                    
                                    <td className={bodyCellClass}>{fmt(row.delta_s_un)}</td>
                                    <td className={bodyCellClass}>{fmt(row.delta_p)}</td>
                                    <td className={bodyCellClass}>{fmt(row.wmd)}</td>
                                    <td className={bodyCellClass}>{fmt(row.wr)}</td>
                                    <td className={bodyCellClass}>{fmt(row.wrep)}</td>
                                    <td className={bodyCellClass}>{fmt(row.wod)}</td>
                                    <td className={bodyCellClass}>{fmt(row.wint)}</td>
                                    <td className={bodyCellClass}>{fmt(row.wl)}</td>
                                    <td className={bodyCellClass}>{fmt(row.wre)}</td>
                                    
                                    <td className={`${bodyCellClass} font-bold`}>{fmt(row.combined_uncertainty)}</td>
                                    
                                    {/* NEW DATA COLUMN: Effective DOF */}
                                    <td className={bodyCellClass}>{fmt(row.effective_dof)}</td>

                                    <td className={bodyCellClass}>{fmt(row.coverage_factor)}</td>
                                    
                                    <td className={`${bodyCellClass} font-bold text-blue-700`}>{fmt(row.expanded_uncertainty)}</td>
                                    <td className={`${bodyCellClass} font-bold text-blue-700`}>{fmt(row.expanded_un_nm)}</td>
                                    <td className={bodyCellClass}>{fmt(row.mean_measurement_error)}</td>
                                    <td className={bodyCellClass}>{fmt(row.max_device_error)}</td>

                                    <td className={`${bodyCellClass} font-semibold text-purple-700 bg-purple-50/50`}>
                                        {fmt(row.cmc)}
                                    </td>
                                    <td className={`${bodyCellClass} text-purple-700 bg-purple-50/50`}>
                                        {fmt(cmcAbs)}
                                    </td>
                                    <td className={`${bodyCellClass} text-purple-700 bg-purple-50/50`}>
                                        {fmt(row.cmc_of_reading)}
                                    </td>
                                    
                                    <td className={`${bodyCellClass} font-bold text-green-700 border-l-2 border-green-200`}>
                                        {fmt(row.final_wl)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default UncertaintyBudgetPage;