import React, { useState, useEffect, useRef } from "react";
import { api, ENDPOINTS } from "../api/config";
import {
  Loader2,
  CheckCircle2,
  Cloud,
  AlertCircle,
  Settings2,
  Plus,
  X,
  Trash2
} from "lucide-react";
import useDebounce from "../hooks/useDebounce";
 
interface RepeatabilitySectionProps {
  jobId: number;
  // Callback to trigger standard re-selection in parent
  // (Naming note: This refreshes standards whether adding OR removing steps)
  onStepAdded?: () => Promise<void>; 
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
 
interface SpecDefaultValues {
  set_pressure: number;
  set_torque: number;
}
 
interface RepeatabilityResponse {
  job_id: number;
  status: string;
  results: any[];
  defaults?: Record<string, SpecDefaultValues>;
}
 
const RepeatabilitySection: React.FC<RepeatabilitySectionProps> = ({ jobId, onStepAdded }) => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [tableData, setTableData] = useState<RepeatabilityRowData[]>([]);
  const [references, setReferences] = useState<UncertaintyReference[]>([]);
 
  const [specDefaults, setSpecDefaults] = useState<Record<string, SpecDefaultValues>>({});
 
  // --- NEW STATE FOR MODAL ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [customInput, setCustomInput] = useState({
    step: "",
    pressure: "",
    torque: ""
  });
 
  const has40 = tableData.some((r) => Number(r.step_percent) === 40);
  const has80 = tableData.some((r) => Number(r.step_percent) === 80);
 
  const debouncedData = useDebounce(
    tableData.map((r) => ({
      step_percent: Number(r.step_percent),
      set_pressure: Number(r.set_pressure),
      set_torque: Number(r.set_torque),
      readings: r.readings,
    })),
    1000
  );
 
  const isFirstRender = useRef(true);
  const isInitialLoad = useRef(true);
 
  const pressureUnit = tableData.length > 0 ? tableData[0].pressure_unit : "psi";
  const torqueUnit = tableData.length > 0 ? tableData[0].torque_unit : "ft-lb";
 
  // --- 1. INITIAL FETCH ---
  useEffect(() => {
    const init = async () => {
      if (!jobId) return;
      setLoading(true);
      try {
        const [jobRes, refRes] = await Promise.all([
          api.get<RepeatabilityResponse>(ENDPOINTS.HTW_REPEATABILITY.GET(jobId)),
          api.get<UncertaintyReference[]>(ENDPOINTS.HTW_REPEATABILITY.REFERENCES),
        ]);
 
        setReferences(refRes.data);
 
        if (jobRes.data.defaults) {
          setSpecDefaults(jobRes.data.defaults);
        }
 
        if (jobRes.data.status === "success" && jobRes.data.results.length > 0) {
          const formattedData: RepeatabilityRowData[] = jobRes.data.results.map((item) => ({
            step_percent: Number(item.step_percent),
            set_pressure: Number(item.set_pressure) || 0,
            set_torque: Number(item.set_torque) || 0,
            readings:
              item.stored_readings && item.stored_readings.length === 5
                ? item.stored_readings.map(String)
                : ["", "", "", "", ""],
            mean_xr: item.mean_xr || null,
            corrected_standard: item.corrected_standard || null,
            corrected_mean: item.corrected_mean || null,
            deviation_percent: item.deviation_percent || null,
            pressure_unit: item.pressure_unit || "",
            torque_unit: item.torque_unit || "",
          }));
 
          formattedData.sort((a, b) => a.step_percent - b.step_percent);
          setTableData(formattedData);
        } else {
          setTableData([]);
        }
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
        setTimeout(() => { isInitialLoad.current = false; }, 500);
      }
    };
    init();
  }, [jobId]);
 
  // --- 2. AUTO-SAVE (Runs on normal edits with delay) ---
  useEffect(() => {
    if (isFirstRender.current || isInitialLoad.current) {
      isFirstRender.current = false;
      return;
    }
    if (!debouncedData) return;
 
    const autoSave = async () => {
      try {
        setSaveStatus("saving");
        await api.post("/htw-calculations/repeatability/draft", {
          job_id: jobId,
          steps: debouncedData.map((r) => ({
            step_percent: Number(r.step_percent),
            set_pressure: Number(r.set_pressure),
            set_torque: Number(r.set_torque),
            readings: r.readings.map((v) => (v === "" || isNaN(Number(v)) ? 0 : Number(v))),
          })),
        });
        setSaveStatus("saved");
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
    const lowerCandidates = references.filter((r) => r.indicated_torque <= val);
    const upperCandidates = references.filter((r) => r.indicated_torque >= val);
    const lowerRef = lowerCandidates.length > 0 ? lowerCandidates[lowerCandidates.length - 1] : null;
    const upperRef = upperCandidates.length > 0 ? upperCandidates[0] : null;
    if (!lowerRef && !upperRef) return 0;
    if (!lowerRef && upperRef) return Math.abs(upperRef.error_value);
    if (lowerRef && !upperRef) return Math.abs(lowerRef.error_value);
    if (lowerRef && upperRef && lowerRef.indicated_torque === upperRef.indicated_torque)
      return Math.abs(lowerRef.error_value);
    if (lowerRef && upperRef) {
      const x = val;
      const x1 = lowerRef.indicated_torque;
      const y1 = lowerRef.error_value;
      const x2 = upperRef.indicated_torque;
      const y2 = upperRef.error_value;
      return Math.abs(y1 + ((x - x1) * (y2 - y1)) / (x2 - x1));
    }
    return 0;
  };
 
  const recalculateRow = (row: RepeatabilityRowData): RepeatabilityRowData => {
    const validReadings = row.readings.filter((r) => r !== "" && !isNaN(Number(r))).map(Number);
    if (validReadings.length === 5) {
      const sum = validReadings.reduce((a, b) => a + b, 0);
      const mean = sum / 5;
      const corrStd = calculateInterpolation(mean);
      const corrMean = mean - corrStd;
      let dev = null;
      if (row.set_torque && row.set_torque !== 0) {
        dev = ((corrMean - row.set_torque) * 100) / row.set_torque;
      }
      return { ...row, mean_xr: mean, corrected_standard: corrStd, corrected_mean: corrMean, deviation_percent: dev };
    }
    return { ...row, mean_xr: null, corrected_standard: null, corrected_mean: null, deviation_percent: null };
  };
 
  // --- 4. STEP MANAGEMENT HANDLERS ---
 
  // Updated Handle Toggle (Used for Both 40/80 checkboxes AND Trash icon deletion)
  const handleToggleStep = async (targetPercent: number) => {
    const exists = tableData.some((r) => Number(r.step_percent) === targetPercent);
 
    if (exists) {
      // --- DELETION LOGIC ---
      // 1. Update UI Immediately
      setTableData((prev) => prev.filter((r) => Number(r.step_percent) !== targetPercent));
      
      try {
        setSaveStatus("saving");
        
        // 2. Delete from DB immediately and WAIT
        await api.delete("/htw-calculations/repeatability/step", {
          data: { job_id: jobId, step_percent: targetPercent },
        });
        
        setSaveStatus("saved");

        // 3. Trigger Parent to Re-select Standards 
        // (Now that the step is gone from DB, backend can shrink the range if needed)
        if (onStepAdded) {
            await onStepAdded();
        }

        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Failed to delete step", err);
        setSaveStatus("error");
        // Optional: You could revert the UI change here if you wanted strict consistency
      }
    } else {
      // --- ADDITION LOGIC (For 40/80 Checkboxes) ---
      setTableData((prev) => {
        const key = targetPercent.toString();
        const defs = specDefaults[key];
        const baseRow = prev.length > 0 ? prev[0] : null;
 
        const newRow: RepeatabilityRowData = {
          step_percent: targetPercent,
          set_pressure: defs ? defs.set_pressure : 0,
          set_torque: defs ? defs.set_torque : 0,
          readings: ["", "", "", "", ""],
          mean_xr: null,
          corrected_standard: null,
          corrected_mean: null,
          deviation_percent: null,
          pressure_unit: baseRow ? baseRow.pressure_unit : pressureUnit,
          torque_unit: baseRow ? baseRow.torque_unit : torqueUnit,
        };
        const newData = [...prev, newRow];
        return newData.sort((a, b) => a.step_percent - b.step_percent);
      });
      
      // Note: For checkbox addition, we rely on the useEffect debouncer to save 
      // and subsequent backend logic, OR we could force save here too. 
      // Given the requirement usually focuses on custom steps, the debouncer is fine here,
      // but deleting needs immediate action to update standards correctly.
    }
  };
 
  // Handles adding a CUSTOM step from Modal
  const handleAddCustomStep = async () => {
    const stepVal = parseFloat(customInput.step);
    const pressVal = parseFloat(customInput.pressure);
    const torqVal = parseFloat(customInput.torque);
 
    if (!stepVal || isNaN(stepVal)) {
      alert("Please enter a valid Step %");
      return;
    }
    if (tableData.some(r => Number(r.step_percent) === stepVal)) {
      alert("This Step % already exists.");
      return;
    }
 
    setIsAddingStep(true);
 
    const baseRow = tableData.length > 0 ? tableData[0] : null;
   
    const newRow: RepeatabilityRowData = {
      step_percent: stepVal,
      set_pressure: isNaN(pressVal) ? 0 : pressVal,
      set_torque: isNaN(torqVal) ? 0 : torqVal,
      readings: ["", "", "", "", ""],
      mean_xr: null,
      corrected_standard: null,
      corrected_mean: null,
      deviation_percent: null,
      pressure_unit: baseRow ? baseRow.pressure_unit : pressureUnit,
      torque_unit: baseRow ? baseRow.torque_unit : torqueUnit,
    };
 
    // 1. Update Local UI immediately
    const updatedData = [...tableData, newRow].sort((a, b) => a.step_percent - b.step_percent);
    setTableData(updatedData);

    try {
      // 2. FORCE SAVE TO DB IMMEDIATELY
      await api.post("/htw-calculations/repeatability/draft", {
        job_id: jobId,
        steps: updatedData.map((r) => ({
            step_percent: Number(r.step_percent),
            set_pressure: Number(r.set_pressure),
            set_torque: Number(r.set_torque),
            readings: r.readings.map((v) => (v === "" || isNaN(Number(v)) ? 0 : Number(v))),
        })),
      });

      setSaveStatus("saved");

      // 3. Trigger Parent to Re-select Standards
      if (onStepAdded) {
        await onStepAdded();
      }
    } catch (e) {
      console.error("Failed to save custom step", e);
      setSaveStatus("error");
      alert("Failed to save step. Please try again.");
    } finally {
      setIsAddingStep(false);
      setCustomInput({ step: "", pressure: "", torque: "" });
      setIsModalOpen(false);
    }
  };
 
  // --- 5. INPUT HANDLERS ---
  const handleReadingChange = (rowIndex: number, readingIndex: number, value: string) => {
    if (!/^\d*.?\d*$/.test(value)) return;
    setTableData((prevData) => {
      const newData = [...prevData];
      const row = { ...newData[rowIndex] };
      const newReadings = [...row.readings];
      newReadings[readingIndex] = value;
      row.readings = newReadings;
      newData[rowIndex] = recalculateRow(row);
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
    <div className="flex flex-col w-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4 relative">
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
            {[40, 80].map((pct) => (
              <label key={pct} className="flex items-center gap-1.5 cursor-pointer hover:opacity-80">
                <input
                  type="checkbox"
                  checked={pct === 40 ? has40 : has80}
                  onChange={() => handleToggleStep(pct)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700">{pct}%</span>
              </label>
            ))}
          </div>
 
          <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>
 
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Custom Step
          </button>
 
          <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>
 
          <div className="flex items-center gap-2 text-xs font-medium min-w-[80px] justify-end">
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
              <th rowSpan={3} className="border border-gray-300 p-2 w-[70px] bg-gray-100 sticky left-0 z-10">Steps %</th>
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
              {[1, 2, 3, 4, 5].map((i) => <th key={i} className="border border-gray-300 p-1 bg-green-50 w-[70px]">S{i}</th>)}
            </tr>
            <tr className="bg-gray-50 text-[9px] font-bold text-blue-700 text-center">
              <th className="border border-gray-300 p-1">{pressureUnit}</th>
              <th className="border border-gray-300 p-1">{torqueUnit}</th>
              {[1, 2, 3, 4, 5].map((i) => <th key={i} className="border border-gray-300 p-1 bg-green-50">{torqueUnit}</th>)}
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
                    <div className="flex items-center justify-between px-1">
                      <span>{row.step_percent}</span>
                      <button
                        onClick={() => handleToggleStep(row.step_percent)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove Step"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                 
                  <td className="p-0 border border-gray-300 relative bg-gray-50">
                    <input
                      type="text"
                      value={row.set_pressure === 0 ? "" : row.set_pressure}
                      readOnly
                      className="w-full h-full p-2 text-center text-sm font-medium focus:outline-none bg-transparent text-gray-500 cursor-default"
                      placeholder="-"
                    />
                  </td>
 
                  <td className="p-0 border border-gray-300 relative bg-gray-50">
                    <input
                      type="text"
                      value={row.set_torque === 0 ? "" : row.set_torque}
                      readOnly
                      className="w-full h-full p-2 text-center text-sm font-medium focus:outline-none bg-transparent text-gray-500 cursor-default"
                      placeholder="-"
                    />
                  </td>
 
                  {row.readings.map((reading, rIndex) => (
                    <td key={rIndex} className="p-0 border border-gray-300 relative bg-white">
                      <input
                        type="text"
                        value={reading}
                        onChange={(e) => handleReadingChange(rowIndex, rIndex, e.target.value)}
                        className="w-full h-full p-2 text-center text-sm font-medium focus:outline-none bg-transparent text-gray-700 focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-400"
                        placeholder="-"
                      />
                    </td>
                  ))}
                  <td className="p-2 border border-gray-300 text-center font-bold text-gray-800 bg-gray-50">{row.mean_xr !== null ? row.mean_xr.toFixed(2) : "-"}</td>
                  <td className="p-2 border border-gray-300 text-center text-gray-600 text-sm">{row.corrected_standard !== null ? row.corrected_standard.toFixed(2) : "-"}</td>
                  <td className="p-2 border border-gray-300 text-center text-gray-600 text-sm">{row.corrected_mean !== null ? row.corrected_mean.toFixed(2) : "-"}</td>
                  {(() => {
                    const dev = row.deviation_percent;
                    const isFail = dev !== null && Math.abs(dev) > 4;
                    const isEmpty = dev === null;
                    return <td className={`p-2 border border-gray-300 text-center font-bold text-sm ${isEmpty ? "text-gray-400" : isFail ? "text-red-600 bg-red-50" : "text-green-700 bg-green-50"}`}>{dev !== null ? dev.toFixed(2) : "-"}</td>;
                  })()}
                  <td className="p-2 border border-gray-300 text-center text-[10px] text-gray-500">±4%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-gray-400 italic text-right">Changes save automatically</div>
 
      {/* --- MODAL WINDOW --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-6 border border-gray-200 relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Add Custom Step</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
 
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Step Percentage (%)</label>
                <input
                  type="number"
                  value={customInput.step}
                  onChange={e => setCustomInput({...customInput, step: e.target.value})}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. 60"
                  autoFocus
                />
              </div>
             
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Set Pressure ({pressureUnit})</label>
                <input
                  type="number"
                  value={customInput.pressure}
                  onChange={e => setCustomInput({...customInput, pressure: e.target.value})}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
 
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Set Torque ({torqueUnit})</label>
                <input
                  type="number"
                  value={customInput.torque}
                  onChange={e => setCustomInput({...customInput, torque: e.target.value})}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
            </div>
 
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                disabled={isAddingStep}
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomStep}
                disabled={isAddingStep}
                className="px-3 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                {isAddingStep && <Loader2 className="h-3 w-3 animate-spin" />}
                Add Step
              </button>
            </div>
          </div>
        </div>
      )}
 
    </div>
  );
};
 
export default RepeatabilitySection;