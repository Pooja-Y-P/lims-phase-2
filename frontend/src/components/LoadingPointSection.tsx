import React, { useState, useEffect, useMemo } from "react";
import { api, ENDPOINTS } from "../api/config";
import { Loader2, Save, Edit, Trash2 } from "lucide-react";

interface LoadingPointSectionProps {
  jobId: number;
}

interface LoadingRowData {
  loading_position_mm: number;
  readings: string[]; // 10 readings
  mean_value: number | null;
}

interface LoadingPointResponse {
  job_id: number;
  status: string;
  set_torque: number;
  error_due_to_loading_point: number;
  torque_unit: string;
  positions: {
    loading_position_mm: number;
    readings: number[];
    mean_value: number;
  }[];
}

const LoadingPointSection: React.FC<LoadingPointSectionProps> = ({ jobId }) => {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Initialize strictly with -10 and +10
  const [tableData, setTableData] = useState<LoadingRowData[]>([
    { loading_position_mm: -10, readings: Array(10).fill(""), mean_value: null },
    { loading_position_mm: 10, readings: Array(10).fill(""), mean_value: null },
  ]);

  const [meta, setMeta] = useState({ set_torque: 0, error_value: 0, torque_unit: "-" });
  const [isSaved, setIsSaved] = useState(false);

  // --- 1. Fetch Data ---
  useEffect(() => {
    const init = async () => {
      if (!jobId) return;
      setLoading(true);
      try {
        const res = await api.get<LoadingPointResponse>(`${ENDPOINTS.HTW_CALCULATIONS.LOADING_POINT}/${jobId}`);
        
        if (res.data.status === "success" && res.data.positions.length > 0) {
            const mapped = res.data.positions.map(p => ({
                loading_position_mm: p.loading_position_mm,
                readings: p.readings.map(String),
                mean_value: p.mean_value
            }));
            
            // Ensure order: -10 then +10
            const sorted = [-10, 10].map(mm => 
                mapped.find(d => d.loading_position_mm === mm) || 
                { loading_position_mm: mm, readings: Array(10).fill(""), mean_value: null }
            );

            setTableData(sorted);
            setMeta({
                set_torque: res.data.set_torque,
                error_value: res.data.error_due_to_loading_point,
                torque_unit: res.data.torque_unit || "-"
            });
            setIsSaved(true); // Assume saved if data exists
        } else {
            // Just populate set torque if no calculations yet
            setMeta(prev => ({ ...prev, set_torque: res.data.set_torque, torque_unit: res.data.torque_unit || "-" }));
        }
      } catch (err) {
        console.error("Failed to load Loading Point data", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [jobId]);

  // --- 2. Handlers ---
  const handleReadingChange = (rowIdx: number, readIdx: number, val: string) => {
    if (isSaved) return;
    if (!/^\d*\.?\d*$/.test(val)) return;

    setTableData(prev => {
        const newData = [...prev];
        const row = { ...newData[rowIdx] };
        row.readings = [...row.readings]; // Clone array
        row.readings[readIdx] = val;
        
        // Calculate Row Mean
        const nums = row.readings.filter(r => r !== "" && !isNaN(Number(r))).map(Number);
        row.mean_value = nums.length === 10 ? nums.reduce((a, b) => a + b, 0) / 10 : null;
        newData[rowIdx] = row;
        
        // Calculate Error (b_l) = Abs(Mean(-10) - Mean(+10))
        // Assuming row 0 is -10 and row 1 is +10
        const m1 = newData[0].mean_value;
        const m2 = newData[1].mean_value;
        
        if (m1 !== null && m2 !== null) {
            setMeta(m => ({ ...m, error_value: Math.abs(m1 - m2) }));
        } else {
            setMeta(m => ({ ...m, error_value: 0 }));
        }
        return newData;
    });
  };

  const handleSave = async () => {
    if(!isFormComplete) return;
    setCalculating(true);
    try {
        // FIX: job_id
        const payload = {
            job_id: jobId,
            positions: tableData.map(r => ({
                loading_position_mm: r.loading_position_mm,
                readings: r.readings.map(Number)
            }))
        };
        const res = await api.post<LoadingPointResponse>(ENDPOINTS.HTW_CALCULATIONS.LOADING_POINT_CALCULATE, payload);
        
        setMeta({
            set_torque: res.data.set_torque,
            error_value: res.data.error_due_to_loading_point,
            torque_unit: res.data.torque_unit || "-"
        });
        setIsSaved(true);
        alert("Section E Saved Successfully!");
    } catch (err: any) {
        console.error(err);
        alert("Error saving: " + (err.response?.data?.detail || err.message));
    } finally {
        setCalculating(false);
    }
  };

  const handleClear = () => {
      if(window.confirm("Clear all readings?")) {
          setTableData(prev => prev.map(r => ({ ...r, readings: Array(10).fill(""), mean_value: null })));
          setMeta(m => ({ ...m, error_value: 0 }));
      }
  };

  const isFormComplete = useMemo(() => tableData.every(r => r.readings.every(v => v !== "")), [tableData]);

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-pink-600"/></div>;

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4 mt-6 mb-12">
        
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
            <h2 className="text-sm font-bold text-black uppercase tracking-tight border-l-4 border-pink-500 pl-2">
                E. Variation due to effect of variation of the force loading point (b<sub>l</sub>)
            </h2>
            {isSaved && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                    <Save className="h-3 w-3" /> Saved
                </div>
            )}
        </div>

        {/* --- MAIN TABLE --- */}
        <div className="overflow-x-auto rounded-lg border border-gray-300">
            <table className="w-full min-w-[900px] border-collapse">
                <thead>
                    <tr className="bg-gray-100 text-[10px] font-bold text-gray-700 uppercase text-center">
                        <th className="border border-gray-300 p-2 w-[100px]">Set Torque</th>
                        <th className="border border-gray-300 p-2 w-[80px]">Position</th>
                        <th colSpan={10} className="border border-gray-300 p-2 bg-green-50 text-green-800">
                            Indicated Readings ({meta.torque_unit})
                        </th>
                        <th className="border border-gray-300 p-2 w-[100px]">Mean Value ({meta.torque_unit})</th>
                        <th className="border border-gray-300 p-2 w-[100px]">Error b<sub>l</sub> ({meta.torque_unit})</th>
                    </tr>
                </thead>
                <tbody>
                    {tableData.map((row, index) => (
                        <tr key={row.loading_position_mm} className="hover:bg-gray-50 transition-colors">
                            {/* Merged Set Torque Cell */}
                            {index === 0 && (
                                <td rowSpan={2} className="p-2 border border-gray-300 font-bold text-center text-gray-800 bg-white align-middle text-lg">
                                    {meta.set_torque}
                                </td>
                            )}

                            {/* Position Label */}
                            <td className="p-2 border border-gray-300 font-bold text-center text-gray-700 bg-gray-50 text-xs">
                                {row.loading_position_mm > 0 ? `+${row.loading_position_mm}` : row.loading_position_mm} mm
                            </td>

                            {/* 10 Reading Inputs */}
                            {row.readings.map((val, cIndex) => (
                                <td key={cIndex} className="p-0 border border-gray-300 w-[50px]">
                                    <input 
                                        type="text" 
                                        value={val}
                                        onChange={(e) => handleReadingChange(index, cIndex, e.target.value)}
                                        disabled={isSaved}
                                        className={`w-full h-full p-2 text-center text-xs font-medium focus:outline-none 
                                            ${isSaved 
                                                ? 'bg-gray-50 text-gray-500' 
                                                : 'bg-transparent text-gray-800 focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-400'
                                            }
                                        `}
                                        placeholder="-"
                                    />
                                </td>
                            ))}

                            {/* Mean Value */}
                            <td className="p-2 border border-gray-300 font-bold text-center text-gray-800 bg-gray-50 text-sm">
                                {row.mean_value !== null ? row.mean_value.toFixed(2) : "-"}
                            </td>

                            {/* Merged Error Cell */}
                            {index === 0 && (
                                <td rowSpan={2} className="p-2 border border-gray-300 font-bold text-center text-blue-700 bg-blue-50 align-middle text-lg">
                                    {meta.error_value !== null && meta.error_value !== 0 ? meta.error_value.toFixed(2) : "-"}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center mt-4">
            <div className="flex gap-2">
                {!isSaved && tableData.some(r => r.readings.some(v => v !== "")) && (
                    <button 
                        onClick={handleClear} 
                        className="px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md flex gap-2 items-center transition-colors"
                    >
                        <Trash2 className="h-3 w-3"/> Clear
                    </button>
                )}
            </div>

            {isSaved ? (
                <button 
                    onClick={() => { if(window.confirm("Unlock to edit?")) setIsSaved(false); }} 
                    className="px-5 py-2 text-xs font-bold uppercase border border-gray-300 bg-white hover:bg-gray-50 rounded-lg flex gap-2 shadow-sm transition-all"
                >
                    <Edit className="h-3 w-3"/> Edit Readings
                </button>
            ) : (
                <button 
                    onClick={handleSave} 
                    disabled={!isFormComplete || calculating} 
                    className={`
                        px-4 py-2 text-xs font-bold uppercase rounded-lg flex gap-2 shadow-sm transition-all
                        ${isFormComplete 
                            ? "bg-pink-600 text-white hover:bg-pink-700 hover:shadow-md" 
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"}
                    `}
                >
                    {calculating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} 
                    Save Calculation
                </button>
            )}
        </div>
    </div>
  );
};

export default LoadingPointSection;