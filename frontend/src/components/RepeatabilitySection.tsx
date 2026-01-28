import React, { useState, useEffect, useRef } from "react";
import { api, ENDPOINTS } from "../api/config";
import { Loader2, CheckCircle2, Cloud, AlertCircle, Settings2 } from "lucide-react";
 
// --- IMPORT YOUR HOOK ---
import useDebounce from "../hooks/useDebounce";
 
interface RepeatabilitySectionProps {
  jobId: number;
}
 
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
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
 
  const [tableData, setTableData] = useState<RepeatabilityRowData[]>([]);
  const [references, setReferences] = useState<UncertaintyReference[]>([]);
 
  // --- DERIVED STATE ---
  const has40 = tableData.some(r => r.step_percent === 40);
  const has80 = tableData.some(r => r.step_percent === 80);
 
  // --- DEBOUNCE SETUP ---
  const debouncedData = useDebounce(
    tableData.map(r => ({
      step_percent: r.step_percent,
      set_pressure: r.set_pressure,
      set_torque: r.set_torque,
      readings: r.readings
    })),
    1000
  );
 
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
 
  // --- 2. AUTO-SAVE EFFECT (DRAFT MODE) ---
  // This handles Adding new rows and Updating existing rows
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
 
    // Note: We deliberately allow saving empty arrays here if needed,
    // but the delete logic is primarily handled in toggleStep now.
    if (!debouncedData) return;
 
    const autoSave = async () => {
      try {
        setSaveStatus("saving");
       
        await api.post("/htw-calculations/repeatability/draft", {
          job_id: jobId,
          steps: debouncedData.map(r => ({
            step_percent: r.step_percent,
            set_pressure: r.set_pressure,
            set_torque: r.set_torque,    
            readings: r.readings.map(v => v === "" || isNaN(Number(v)) ? 0 : Number(v))
          }))
        });
 
        setSaveStatus("saved");
        setLastSaved(new Date());
      } catch (err) {
        console.error("Draft Save Failed", err);
        setSaveStatus("error");
      }
    };
 
    autoSave();
  }, [debouncedData, jobId]);
 
  // --- 3. MATH HELPERS ---
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
 
  const recalculateRow = (row: RepeatabilityRowData): RepeatabilityRowData => {
      const validReadings = row.readings.filter(r => r !== "" && !isNaN(Number(r))).map(Number);
     
      if (validReadings.length === 5) {
            const sum = validReadings.reduce((a, b) => a + b, 0);
            const mean = sum / 5;
            const corrStd = calculateInterpolation(mean);
            const corrMean = mean - corrStd;
           
            let dev = null;
            if (row.set_torque && row.set_torque !== 0) {
                dev = ((corrMean - row.set_torque) * 100) / row.set_torque;
            }
 
            return {
                ...row,
                mean_xr: mean,
                corrected_standard: corrStd,
                corrected_mean: corrMean,
                deviation_percent: dev
            };
      } else {
            return {
                ...row,
                mean_xr: null,
                corrected_standard: null,
                corrected_mean: null,
                deviation_percent: null
            };
      }
  };
 
  // --- 4. TOGGLE STEP HANDLER (UPDATED FOR DELETION) ---
  const handleToggleStep = async (targetPercent: number) => {
    // Check if the step currently exists
    const exists = tableData.find(r => r.step_percent === targetPercent);
 
    if (exists) {
        // --- CASE: UNCHECKING (DELETE) ---
       
        // 1. Optimistically remove from UI immediately
        setTableData(prev => prev.filter(r => r.step_percent !== targetPercent));
 
        // 2. Fire immediate API call to delete from Database
        try {
            setSaveStatus("saving");
           
            // NOTE: Ensure your backend has a DELETE route.
            // If your backend expects query params: /url?job_id=X&step_percent=Y
            // If your backend expects a JSON body, Axios requires the 'data' key for DELETE requests:
            await api.delete("/htw-calculations/repeatability/step", {
                data: {
                    job_id: jobId,
                    step_percent: targetPercent
                }
            });
 
            setSaveStatus("saved");
            // Reset status after a moment so user knows it's done
            setTimeout(() => setSaveStatus("idle"), 2000);
        } catch (err) {
            console.error("Failed to delete step", err);
            setSaveStatus("error");
            // Optional: Revert UI change if delete fails hard (add row back)
        }
 
    } else {
        // --- CASE: CHECKING (ADD) ---
       
        setTableData(prev => {
            const baseRow = prev.length > 0 ? prev[0] : null;
            const pUnit = baseRow ? baseRow.pressure_unit : "";
            const tUnit = baseRow ? baseRow.torque_unit : "";
 
            const newRow: RepeatabilityRowData = {
                step_percent: targetPercent,
                set_pressure: 0,
                set_torque: 0,
                readings: ["", "", "", "", ""],
                mean_xr: null,
                corrected_standard: null,
                corrected_mean: null,
                deviation_percent: null,
                pressure_unit: pUnit,
                torque_unit: tUnit
            };
 
            const newData = [...prev, newRow];
            return newData.sort((a, b) => a.step_percent - b.step_percent);
        });
       
        // No manual API call needed here; the useEffect auto-save will pick up
        // the new row after the debounce delay and save it.
    }
  };
 
  // --- 5. INPUT HANDLERS ---
  const handleSetValChange = (rowIndex: number, field: 'set_pressure' | 'set_torque', value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return;
 
    setTableData(prev => {
        const newData = [...prev];
        const row = { ...newData[rowIndex] };
        row[field] = value === "" ? 0 : parseFloat(value);
        const updatedRow = recalculateRow(row);
        newData[rowIndex] = updatedRow;
        return newData;
    });
  };
 
  const handleReadingChange = (rowIndex: number, readingIndex: number, value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return;
 
    setTableData(prevData => {
        const newData = [...prevData];
        const row = { ...newData[rowIndex] };
        const newReadings = [...row.readings];
        newReadings[readingIndex] = value;
        row.readings = newReadings;
        const updatedRow = recalculateRow(row);
        newData[rowIndex] = updatedRow;
        return newData;
    });
  };
 
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
       
        {/* HEADER */}
        <div className="mb-4 flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-sm font-bold text-black uppercase tracking-tight border-l-4 border-orange-500 pl-2">
                A. Repeatability (ISO 6789-1)
            </h2>
 
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                        <Settings2 className="w-3.5 h-3.5 text-gray-400" />
                        <span>Include:</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={has40} onChange={() => handleToggleStep(40)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs text-gray-700">40%</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={has80} onChange={() => handleToggleStep(80)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs text-gray-700">80%</span>
                    </label>
                </div>
 
                <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>
 
                <div className="flex items-center gap-2 text-xs font-medium min-w-[100px] justify-end">
                    {saveStatus === "saving" && <span className="text-blue-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span>}
                    {saveStatus === "saved" && <span className="text-green-600 flex items-center gap-1 transition-opacity duration-1000"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
                    {saveStatus === "error" && <span className="text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Error</span>}
                    {saveStatus === "idle" && <span className="text-gray-400 flex items-center gap-1"><Cloud className="h-3 w-3" /> Synced</span>}
                </div>
            </div>
        </div>
 
        {/* TABLE */}
        <div className="overflow-x-auto rounded-lg border border-gray-300">
            <table className="w-full min-w-[850px] border-collapse">
                <thead>
                    <tr className="bg-gray-100 text-[10px] font-bold text-gray-700 uppercase tracking-tight text-center">
                        <th rowSpan={3} className="border border-gray-300 p-2 w-[60px] bg-gray-100 sticky left-0 z-10">Steps %</th>
                        <th className="border border-gray-300 p-2 w-[80px]">Set Pressure</th>
                        <th className="border border-gray-300 p-2 w-[80px]">Set Torque</th>
                        <th colSpan={5} className="border border-gray-300 p-2 bg-green-50 text-green-800">Readings (Master Standard)</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[80px]">Mean (Xr)</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[80px]">Corr. Std</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[80px]">Corr. Mean</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[70px]">Dev %</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[60px]">Tol</th>
                    </tr>
                   
                    <tr className="bg-gray-50 text-[9px] font-bold text-gray-600 text-center">
                        <th className="border border-gray-300 p-1">Ps</th>
                        <th className="border border-gray-300 p-1">Ts</th>
                        {[1, 2, 3, 4, 5].map(i => <th key={i} className="border border-gray-300 p-1 bg-green-50 w-[70px]">S{i}</th>)}
                    </tr>
 
                    <tr className="bg-gray-50 text-[9px] font-bold text-blue-700 text-center">
                        <th className="border border-gray-300 p-1">{pressureUnit}</th>
                        <th className="border border-gray-300 p-1">{torqueUnit}</th>
                        {[1, 2, 3, 4, 5].map(i => <th key={i} className="border border-gray-300 p-1 bg-green-50">{torqueUnit}</th>)}
                        <th className="border border-gray-300 p-1">{torqueUnit}</th>
                        <th className="border border-gray-300 p-1">{torqueUnit}</th>
                        <th className="border border-gray-300 p-1">{torqueUnit}</th>
                        <th className="border border-gray-300 p-1">%</th>
                        <th className="border border-gray-300 p-1">±4%</th>
                    </tr>
                </thead>
 
                <tbody>
                    {tableData.length === 0 ? (
                        <tr><td colSpan={14} className="p-6 text-center text-gray-400 italic border border-gray-300">No specification data available.</td></tr>
                    ) : (
                        tableData.map((row, rowIndex) => (
                            <tr key={row.step_percent} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="p-2 border border-gray-300 font-bold text-center text-gray-700 bg-gray-50 sticky left-0 group-hover:bg-gray-100">
                                    {row.step_percent}
                                </td>
                               
                                {/* EDITABLE SET PRESSURE */}
                                <td className="p-0 border border-gray-300 relative">
                                    <input
                                        type="text"
                                        value={row.set_pressure === 0 ? "" : row.set_pressure}
                                        onChange={(e) => handleSetValChange(rowIndex, 'set_pressure', e.target.value)}
                                        className="w-full h-full p-2 text-center text-sm font-medium focus:outline-none bg-transparent text-gray-800 focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-400 placeholder:text-gray-400"
                                        placeholder="-"
                                    />
                                </td>
 
                                {/* EDITABLE SET TORQUE */}
                                <td className="p-0 border border-gray-300 relative">
                                    <input
                                        type="text"
                                        value={row.set_torque === 0 ? "" : row.set_torque}
                                        onChange={(e) => handleSetValChange(rowIndex, 'set_torque', e.target.value)}
                                        className="w-full h-full p-2 text-center text-sm font-medium focus:outline-none bg-transparent text-gray-800 focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-400 placeholder:text-gray-400"
                                        placeholder="-"
                                    />
                                </td>
 
                                {/* READING INPUTS */}
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
 
                                <td className="p-2 border border-gray-300 text-center font-bold text-gray-800 bg-gray-50">
                                    {row.mean_xr !== null ? row.mean_xr.toFixed(2) : "-"}
                                </td>
                                <td className="p-2 border border-gray-300 text-center text-gray-600 text-sm">
                                    {row.corrected_standard !== null ? row.corrected_standard.toFixed(2) : "-"}
                                </td>
                                <td className="p-2 border border-gray-300 text-center text-gray-600 text-sm">
                                    {row.corrected_mean !== null ? row.corrected_mean.toFixed(2) : "-"}
                                </td>
                               
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
                                <td className="p-2 border border-gray-300 text-center text-[10px] text-gray-500">±4%</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
       
        <div className="mt-2 text-[10px] text-gray-400 italic text-right">
             Changes save automatically
        </div>
    </div>
  );
};
 
export default RepeatabilitySection;
 