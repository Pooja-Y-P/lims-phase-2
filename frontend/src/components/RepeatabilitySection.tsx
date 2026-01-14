import React, { useState, useEffect, useMemo } from "react";
import { api, ENDPOINTS } from "../api/config";
import { Loader2, AlertCircle, Save, Edit, Trash2 } from "lucide-react";

interface RepeatabilitySectionProps {
  jobId: number;
}

// Unified Row Interface used for State
interface RepeatabilityRowData {
  step_percent: number;
  set_pressure: number;
  set_torque: number;
  readings: string[]; 
  mean_xr: number | null;
  corrected_standard: number | null;
  corrected_mean: number | null;
  deviation_percent: number | null;
  pressure_unit: string;
  torque_unit: string;
}

interface BackendResult {
  step_percent: number;
  mean_xr: number;
  set_pressure: number;
  set_torque: number;
  corrected_standard: number;
  corrected_mean: number;
  deviation_percent: number;
  stored_readings?: number[];
  pressure_unit: string;
  torque_unit: string;
}

interface RepeatabilityResponse {
  job_id: number;
  status: string;
  results: BackendResult[];
}

// Interface for Reference Data (for frontend interpolation)
interface UncertaintyReference {
  indicated_torque: number;
  error_value: number;
}

const RepeatabilitySection: React.FC<RepeatabilitySectionProps> = ({ jobId }) => {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const [tableData, setTableData] = useState<RepeatabilityRowData[]>([]);
  const [references, setReferences] = useState<UncertaintyReference[]>([]);

  // State: Is the form currently saved (read-only)?
  const [isSaved, setIsSaved] = useState(false);

  // Extract units for display (Safe access from first row)
  const pressureUnit = tableData.length > 0 ? tableData[0].pressure_unit : "-";
  const torqueUnit = tableData.length > 0 ? tableData[0].torque_unit : "-";

  // --- 1. INITIAL FETCH ---
  useEffect(() => {
    const init = async () => {
        if (!jobId) return;
        setLoading(true);
        try {
            const [jobRes, refRes] = await Promise.all([
                api.get<RepeatabilityResponse>(ENDPOINTS.HTW_REPEATABILITY.GET(jobId)),
                api.get<UncertaintyReference[]>(ENDPOINTS.HTW_REPEATABILITY.REFERENCES) 
            ]);

            setReferences(refRes.data);

            if (jobRes.data.status === "success" && jobRes.data.results.length > 0) {
                // Check if we have actual saved readings to set Read-Only mode
                const hasSavedReadings = jobRes.data.results.some(r => r.stored_readings && r.stored_readings.length > 0);
                setIsSaved(hasSavedReadings);

                const formattedData: RepeatabilityRowData[] = jobRes.data.results.map(item => ({
                    step_percent: item.step_percent,
                    set_pressure: item.set_pressure,
                    set_torque: item.set_torque,
                    readings: item.stored_readings && item.stored_readings.length === 5 
                        ? item.stored_readings.map(String) 
                        : ["", "", "", "", ""],
                    mean_xr: item.mean_xr || null,
                    corrected_standard: item.corrected_standard || null,
                    corrected_mean: item.corrected_mean || null,
                    deviation_percent: item.deviation_percent || null,
                    pressure_unit: item.pressure_unit,
                    torque_unit: item.torque_unit
                }));
                formattedData.sort((a, b) => a.step_percent - b.step_percent);
                setTableData(formattedData);
                setDataLoaded(true);
            }
        } catch (err) {
            console.error("Failed to load data", err);
        } finally {
            setLoading(false);
        }
    };
    init();
  }, [jobId]);

  // --- 2. LOCAL MATH HELPERS ---
  const calculateInterpolation = (val: number): number => {
      if (references.length === 0) return 0;
      const lowerCandidates = references.filter(r => r.indicated_torque <= val);
      const upperCandidates = references.filter(r => r.indicated_torque >= val);
      const lowerRef = lowerCandidates.length > 0 ? lowerCandidates[lowerCandidates.length - 1] : null;
      const upperRef = upperCandidates.length > 0 ? upperCandidates[0] : null;

      if (!lowerRef && !upperRef) return 0;
      if (!lowerRef && upperRef) return Math.abs(upperRef.error_value);
      if (lowerRef && !upperRef) return Math.abs(lowerRef.error_value);
      if (lowerRef && upperRef && lowerRef.indicated_torque === upperRef.indicated_torque) return Math.abs(lowerRef.error_value);

      if (lowerRef && upperRef) {
          const x = val;
          const x1 = lowerRef.indicated_torque;
          const y1 = lowerRef.error_value;
          const x2 = upperRef.indicated_torque;
          const y2 = upperRef.error_value;
          const rawY = y1 + ((x - x1) * (y2 - y1) / (x2 - x1));
          return Math.abs(rawY);
      }
      return 0;
  };

  // --- 3. DYNAMIC INPUT HANDLER ---
  const handleReadingChange = (rowIndex: number, readingIndex: number, value: string) => {
    if (isSaved) return; // Block edits if saved
    if (!/^\d*\.?\d*$/.test(value)) return;

    setTableData(prevData => {
        const newData = [...prevData];
        const row = { ...newData[rowIndex] };
        const newReadings = [...row.readings];
        newReadings[readingIndex] = value;
        row.readings = newReadings;

        // --- REAL-TIME CALCULATION ---
        const validReadings = newReadings.filter(r => r !== "" && !isNaN(Number(r))).map(Number);
        
        if (validReadings.length === 5) {
             const sum = validReadings.reduce((a, b) => a + b, 0);
             const mean = sum / 5;
             row.mean_xr = mean;
             const corrStd = calculateInterpolation(mean);
             row.corrected_standard = corrStd;
             const corrMean = mean - corrStd;
             row.corrected_mean = corrMean;
             if (row.set_torque !== 0) {
                 const dev = ((corrMean - row.set_torque) * 100) / row.set_torque;
                 row.deviation_percent = dev;
             } else {
                 row.deviation_percent = 0;
             }
        } else {
             row.mean_xr = null;
             row.corrected_standard = null;
             row.corrected_mean = null;
             row.deviation_percent = null;
        }
        newData[rowIndex] = row;
        return newData;
    });
  };

  const isFormComplete = useMemo(() => {
      if (tableData.length === 0) return false;
      return tableData.every(row => 
          row.readings.every(r => r !== "" && !isNaN(Number(r)))
      );
  }, [tableData]);

  // --- 4. ACTIONS ---
  
  const handleSave = async () => {
    if (!isFormComplete) return;
    setCalculating(true);
    try {
      const payload = {
        job_id: jobId,
        steps: tableData.map(row => ({
          step_percent: row.step_percent,
          readings: row.readings.map(Number)
        }))
      };
      
      await api.post<RepeatabilityResponse>(
        ENDPOINTS.HTW_REPEATABILITY.CALCULATE, 
        payload
      );
      
      setIsSaved(true); // Lock the form
      alert("Worksheet Saved Successfully!");
    } catch (error: any) {
      console.error("Save failed", error);
      alert(`Error: ${error.response?.data?.detail || "Failed to save."}`);
    } finally {
      setCalculating(false);
    }
  };

  // Unlock for editing
  const handleEdit = () => {
      if (window.confirm("Unlock to edit? Unsaved changes will be lost if you don't save again.")) {
          setIsSaved(false);
      }
  };

  // Clear unsaved data
  const handleClear = () => {
      if (isSaved) return;
      if (!window.confirm("Clear all readings?")) return;

      setTableData(prev => prev.map(row => ({
          ...row,
          readings: ["", "", "", "", ""],
          mean_xr: null,
          corrected_standard: null,
          corrected_mean: null,
          deviation_percent: null
      })));
  };

  // --- RENDER ---
  if (loading && !dataLoaded) {
      return (
          <div className="h-48 flex flex-col items-center justify-center text-gray-400 border border-gray-200 rounded-xl bg-gray-50">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <span className="text-xs">Loading Specs...</span>
          </div>
      );
  }

  // --- STYLES (Kept exactly as requested) ---
  const thBase = "border border-black px-1 py-1.5 font-bold text-center align-middle bg-gray-50 text-black";
  const thUnit = "border border-black px-1 py-1 font-bold text-center align-middle bg-blue-50 text-blue-800 text-[10px]";
  const tdBase = "border border-black px-1 py-1 text-center align-middle text-black font-medium";

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        
        {/* HEADER Title */}
        <div className="mb-4 flex justify-between items-center">
            <h2 className="text-sm font-bold text-black uppercase tracking-tight border-l-4 border-orange-500 pl-2">
                A. Repeatability (ISO 6789-1)
            </h2>
            
            {/* Added: Saved Badge */}
            {isSaved && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                    <Save className="h-3 w-3" /> Saved (Read-Only)
                </div>
            )}
        </div>

        {/* STRICT ISO TABLE */}
        <div className="overflow-x-auto rounded-lg border border-gray-300">
            <table className="w-full min-w-[850px] border-collapse">
                <thead>
                    {/* 1. Main Header */}
                    <tr className="bg-gray-100 text-[10px] font-bold text-gray-700 uppercase tracking-tight text-center">
                        <th rowSpan={3} className="border border-gray-300 p-2 w-[60px] bg-gray-100 sticky left-0 z-10">Steps in %</th>
                        <th className="border border-gray-300 p-2 w-[80px]">Set Pressure in Pressure Gauge</th>
                        <th className="border border-gray-300 p-2 w-[80px]">Set Torque (DUC)</th>
                        <th colSpan={5} className="border border-gray-300 p-2 bg-green-50 text-green-800">Indicated Reading in Master Standard (Tstd)</th>
                        
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[80px]">Mean (Xr)</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[80px]">Corrected Standard</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[80px]">Corrected Mean</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[70px]">Deviation Max</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[60px]">Tolerance</th>
                    </tr>
                    
                    {/* 2. Symbol Header */}
                    <tr className="bg-gray-50 text-[9px] font-bold text-gray-600 text-center">
                        <th className="border border-gray-300 p-1">Ps</th>
                        <th className="border border-gray-300 p-1">Ts</th>
                        {[1, 2, 3, 4, 5].map(i => (
                            <th key={i} className="border border-gray-300 p-1 bg-green-50 w-[70px]">S{i}</th>
                        ))}
                    </tr>

                    {/* 3. Unit Header (Dynamic) */}
                    <tr className="bg-gray-50 text-[9px] font-bold text-blue-700 text-center">
                        {/* Ps Unit */}
                        <th className="border border-gray-300 p-1">{pressureUnit}</th>
                        
                        {/* Ts Unit */}
                        <th className="border border-gray-300 p-1">{torqueUnit}</th>
                        
                        {/* S1-S5 Units (Green) */}
                        {[1, 2, 3, 4, 5].map(i => (
                            <th key={i} className="border border-gray-300 p-1 bg-green-50">{torqueUnit}</th>
                        ))}

                        {/* EXPANDED UNITS */}
                        <th className="border border-gray-300 p-1">{torqueUnit}</th> 
                        <th className="border border-gray-300 p-1">{torqueUnit}</th> 
                        <th className="border border-gray-300 p-1">{torqueUnit}</th> 

                        {/* Deviation */}
                        <th className="border border-gray-300 p-1">%</th>
                        
                        {/* Tolerance */}
                        <th className="border border-gray-300 p-1">±4%</th>
                    </tr>
                </thead>

                <tbody>
                    {tableData.length === 0 ? (
                        <tr>
                            <td colSpan={14} className="p-6 text-center text-gray-400 italic border border-gray-300">
                                No specification data available.
                            </td>
                        </tr>
                    ) : (
                        tableData.map((row, rowIndex) => (
                            <tr key={row.step_percent} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="p-2 border border-gray-300 font-bold text-center text-gray-700 bg-gray-50 sticky left-0 group-hover:bg-gray-100">
                                    {row.step_percent}
                                </td>
                                
                                <td className="p-2 border border-gray-300 text-center text-gray-800 font-medium">
                                    {row.set_pressure || "-"}
                                </td>
                                <td className="p-2 border border-gray-300 text-center text-gray-800 font-medium">
                                    {row.set_torque || "-"}
                                </td>

                                {/* Input Readings S1-S5 (GREEN CELLS) */}
                                {row.readings.map((reading, rIndex) => (
                                    <td key={rIndex} className="p-0 border border-gray-300 relative">
                                        <input
                                            type="text"
                                            value={reading}
                                            onChange={(e) => handleReadingChange(rowIndex, rIndex, e.target.value)}
                                            disabled={isSaved} // Disable if saved
                                            className={`w-full h-full p-2 text-center text-sm font-medium focus:outline-none 
                                                ${isSaved 
                                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed' // Locked style
                                                    : 'bg-transparent text-gray-700 focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-400' // Editable style
                                                }
                                            `}
                                            placeholder="-"
                                        />
                                    </td>
                                ))}

                                {/* Mean (Xr) */}
                                <td className="p-2 border border-gray-300 text-center font-bold text-gray-800 bg-gray-50">
                                    {row.mean_xr !== null ? row.mean_xr.toFixed(2) : "-"}
                                </td>

                                {/* Corrected Standard */}
                                <td className="p-2 border border-gray-300 text-center text-gray-600 text-sm">
                                    {row.corrected_standard !== null ? row.corrected_standard.toFixed(2) : "-"}
                                </td>

                                {/* Corrected Mean */}
                                <td className="p-2 border border-gray-300 text-center text-gray-600 text-sm">
                                    {row.corrected_mean !== null ? row.corrected_mean.toFixed(2) : "-"}
                                </td>

                                {/* Deviation */}
                                {(() => {
                                    const dev = row.deviation_percent;
                                    const isFail = dev !== null && Math.abs(dev) > 4;
                                    const isEmpty = dev === null;
                                    
                                    return (
                                        <td className={`p-2 border border-gray-300 text-center font-bold text-sm ${
                                            isEmpty ? "text-gray-400" : isFail ? "text-red-600 bg-red-50" : "text-green-700 bg-green-50"
                                        }`}>
                                            {dev !== null ? dev.toFixed(2) : "-"}
                                        </td>
                                    );
                                })()}

                                {/* Tolerance */}
                                <td className="p-2 border border-gray-300 text-center text-[10px] text-gray-500">
                                    ±4%
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {/* FOOTER ACTIONS (UPDATED) */}
        <div className="flex justify-between items-center mt-4">
            
            {/* Left: Clear or Warning */}
            <div className="flex gap-2">
                {!isSaved && tableData.some(r => r.readings.some(v => v !== "")) && (
                    <button 
                        onClick={handleClear}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                    >
                        <Trash2 className="h-3 w-3" /> Clear
                    </button>
                )}
                {!isSaved && !isFormComplete && tableData.length > 0 && (
                     <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-md border border-amber-100">
                        <AlertCircle className="h-4 w-4" />
                        <span>Enter all readings</span>
                    </div>
                )}
            </div>

            {/* Right: Save or Edit */}
            {isSaved ? (
                <button
                    onClick={handleEdit}
                    className="px-5 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-lg shadow-sm flex items-center gap-2"
                >
                    <Edit className="h-3 w-3" /> Edit Readings
                </button>
            ) : (
                <button
                    onClick={handleSave}
                    disabled={!isFormComplete || calculating}
                    className={`
                        px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-sm transition-all
                        ${isFormComplete 
                            ? "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md" 
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"}
                    `}
                >
                    {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {calculating ? "Calculate & Save" : "Save Worksheet"}
                </button>
            )}
        </div>

    </div>
  );
};

export default RepeatabilitySection;