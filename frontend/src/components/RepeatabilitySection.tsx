import React, { useState, useEffect, useRef } from "react";
import { api, ENDPOINTS } from "../api/config";
import { Loader2, CheckCircle2, Cloud, AlertCircle } from "lucide-react";

// --- IMPORT YOUR HOOK ---
// Ensure this path matches where you saved the hook
import useDebounce from "../hooks/useDebounce"; 

interface RepeatabilitySectionProps {
  jobId: number;
}

// Unified Row Interface
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

interface UncertaintyReference {
  indicated_torque: number;
  error_value: number;
}

// Types for API Responses
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

const RepeatabilitySection: React.FC<RepeatabilitySectionProps> = ({ jobId }) => {
  // --- STATE ---
  const [loading, setLoading] = useState(false); // Initial Load
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const [tableData, setTableData] = useState<RepeatabilityRowData[]>([]);
  const [references, setReferences] = useState<UncertaintyReference[]>([]);

  // --- DEBOUNCE SETUP ---
  // We debounce the entire tableData object. API calls trigger 1000ms after last change.
  const debouncedReadings = useDebounce(
  tableData.map(r => ({
    step_percent: r.step_percent,
    readings: r.readings
  })),
  1000
);

  
  // Ref to prevent auto-save running immediately on component mount
  const isFirstRender = useRef(true);

  // Extract units for display
  const pressureUnit = tableData.length > 0 ? tableData[0].pressure_unit : "-";
  const torqueUnit = tableData.length > 0 ? tableData[0].torque_unit : "-";

  // --- 1. INITIAL DATA FETCH ---
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
            }
        } catch (err) {
            console.error("Failed to load data", err);
        } finally {
            setLoading(false);
        }
    };
    init();
  }, [jobId]);

  // --- 2. AUTO-SAVE EFFECT ---
  useEffect(() => {
  if (isFirstRender.current) {
    isFirstRender.current = false;
    return;
  }

  if (!debouncedReadings || debouncedReadings.length === 0) return;

  const hasAnyInput = debouncedReadings.some(r =>
    r.readings.some(v => v !== "" && !isNaN(Number(v)))
  );

  if (!hasAnyInput) return;

  const autoSave = async () => {
    try {
      setSaveStatus("saving");

      await api.post(ENDPOINTS.HTW_REPEATABILITY.CALCULATE, {
        job_id: jobId,
        steps: debouncedReadings.map(r => ({
          step_percent: r.step_percent,
          readings: r.readings.map(v =>
            v === "" || isNaN(Number(v)) ? 0 : Number(v)
          )
        }))
      });

      setSaveStatus("saved");
      setLastSaved(new Date());
    } catch {
      setSaveStatus("error");
    }
  };

  autoSave();
}, [debouncedReadings, jobId]);




  // --- 3. LOCAL MATH HELPERS ---
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

  // --- 4. INPUT HANDLER ---
  const handleReadingChange = (rowIndex: number, readingIndex: number, value: string) => {
    // Basic validation: allow numbers and one decimal point
    if (!/^\d*\.?\d*$/.test(value)) return;

    setTableData(prevData => {
        const newData = [...prevData];
        const row = { ...newData[rowIndex] };
        const newReadings = [...row.readings];
        newReadings[readingIndex] = value;
        row.readings = newReadings;

        // --- REAL-TIME LOCAL CALCULATION ---
        // We calculate locally so the UI feels instant (0ms latency), 
        // while the debounce logic handles the "Save" (1000ms latency).
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
             // If data is partial, clear calculations visually
             row.mean_xr = null;
             row.corrected_standard = null;
             row.corrected_mean = null;
             row.deviation_percent = null;
        }
        newData[rowIndex] = row;
        return newData;
    });
  };

  // --- RENDER ---
  if (loading) {
      return (
          <div className="h-48 flex flex-col items-center justify-center text-gray-400 border border-gray-200 rounded-xl bg-gray-50">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <span className="text-xs">Loading Specs...</span>
          </div>
      );
  }

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        
        {/* HEADER Title & Status */}
        <div className="mb-4 flex justify-between items-center">
            <h2 className="text-sm font-bold text-black uppercase tracking-tight border-l-4 border-orange-500 pl-2">
                A. Repeatability (ISO 6789-1)
            </h2>
            
            {/* Auto-Save Status Indicator */}
            <div className="flex items-center gap-2 text-xs font-medium">
                {saveStatus === "saving" && (
                    <span className="text-blue-600 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                    </span>
                )}
                {saveStatus === "saved" && (
                    <span className="text-green-600 flex items-center gap-1 transition-opacity duration-1000">
                        <CheckCircle2 className="h-3 w-3" /> Saved 
                        <span className="text-gray-400 text-[10px] ml-1">
                            {lastSaved?.toLocaleTimeString()}
                        </span>
                    </span>
                )}
                {saveStatus === "error" && (
                    <span className="text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Save Failed
                    </span>
                )}
                {saveStatus === "idle" && (
                    <span className="text-gray-400 flex items-center gap-1">
                        <Cloud className="h-3 w-3" /> Up to date
                    </span>
                )}
            </div>
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
                        <th className="border border-gray-300 p-1">{pressureUnit}</th>
                        <th className="border border-gray-300 p-1">{torqueUnit}</th>
                        
                        {[1, 2, 3, 4, 5].map(i => (
                            <th key={i} className="border border-gray-300 p-1 bg-green-50">{torqueUnit}</th>
                        ))}

                        <th className="border border-gray-300 p-1">{torqueUnit}</th> 
                        <th className="border border-gray-300 p-1">{torqueUnit}</th> 
                        <th className="border border-gray-300 p-1">{torqueUnit}</th> 

                        <th className="border border-gray-300 p-1">%</th>
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
                                            className="w-full h-full p-2 text-center text-sm font-medium focus:outline-none bg-transparent text-gray-700 focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-400"
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
        
        {/* Footer Note */}
        <div className="mt-2 text-[10px] text-gray-400 italic text-right">
             Changes save automatically
        </div>
    </div>
  );
};

export default RepeatabilitySection;