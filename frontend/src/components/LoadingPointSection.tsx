import React, { useState, useEffect, useRef } from "react";
import { api, ENDPOINTS } from "../api/config";
import { Loader2, CheckCircle2, AlertCircle, Cloud, Trash2 } from "lucide-react";
import useDebounce from "../hooks/useDebounce"; 

interface LoadingPointSectionProps {
  jobId: number;
}

interface LoadingRowData {
  loading_position_mm: number;
  readings: string[]; // 10 readings per row
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

// --- Skeleton Component ---
const LoadingPointSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-white border border-gray-200 rounded-xl shadow-sm p-4 mt-6 mb-12 animate-pulse">
      {/* Header Skeleton */}
      <div className="mb-4 flex justify-between items-center">
        <div className="h-6 w-1/3 bg-gray-200 rounded"></div>
        <div className="h-4 w-20 bg-gray-200 rounded"></div>
      </div>

      {/* Table Skeleton */}
      <div className="overflow-x-auto rounded-lg border border-gray-300">
        <div className="w-full min-w-[900px]">
          {/* Table Head */}
          <div className="flex bg-gray-100 border-b border-gray-300 p-2">
            <div className="w-[100px] h-4 bg-gray-300 rounded mr-2"></div>
            <div className="w-[80px] h-4 bg-gray-300 rounded mr-2"></div>
            <div className="flex-1 h-4 bg-gray-200 rounded mr-2"></div>
            <div className="w-[100px] h-4 bg-gray-300 rounded"></div>
          </div>
          
          {/* Table Body - 2 Rows */}
          {[1, 2].map((i) => (
            <div key={i} className="flex border-b border-gray-100 p-2 items-center">
              <div className="w-[100px] h-8 bg-gray-200 rounded mr-2"></div>
              <div className="w-[80px] h-6 bg-gray-200 rounded mr-2"></div>
              <div className="flex-1 flex gap-2 mr-2">
                 {[...Array(10)].map((_, j) => (
                    <div key={j} className="h-8 w-full bg-gray-100 rounded"></div>
                 ))}
              </div>
              <div className="w-[100px] h-8 bg-gray-200 rounded"></div>
            </div>
          ))}

          {/* Footer Row */}
          <div className="bg-blue-50 border-t-2 border-blue-100 p-4 flex justify-center items-center gap-4">
             <div className="h-4 w-48 bg-gray-300 rounded"></div>
             <div className="h-8 w-24 bg-white rounded border border-gray-200"></div>
          </div>
        </div>
      </div>

      {/* Footer Actions Skeleton */}
      <div className="flex justify-between items-center mt-3 h-8">
        <div className="h-8 w-20 bg-gray-200 rounded"></div>
        <div className="h-3 w-32 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
};

// --- Main Component ---
const LoadingPointSection: React.FC<LoadingPointSectionProps> = ({ jobId }) => {
  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastSavedPayload = useRef<string | null>(null);

  const [tableData, setTableData] = useState<LoadingRowData[]>([
    { loading_position_mm: -10, readings: Array(10).fill(""), mean_value: null },
    { loading_position_mm: 10, readings: Array(10).fill(""), mean_value: null },
  ]);

  const [meta, setMeta] = useState({ set_torque: 0, error_value: 0, torque_unit: "-" });

  // --- DEBOUNCE SETUP ---
  const debouncedTableData = useDebounce(tableData, 1000);
  const hasUserEdited = useRef(false);

  // --- 1. FETCH INITIAL DATA ---
  useEffect(() => {
    if (!jobId) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        const res = await api.get<LoadingPointResponse>(`${ENDPOINTS.HTW_CALCULATIONS.LOADING_POINT}/${jobId}`);
        
        let currentData = [
            { loading_position_mm: -10, readings: Array(10).fill(""), mean_value: null },
            { loading_position_mm: 10, readings: Array(10).fill(""), mean_value: null },
        ] as LoadingRowData[];

        if (res.data.status === "success" && res.data.positions.length > 0) {
          const mapped = res.data.positions.map(p => ({
            loading_position_mm: p.loading_position_mm,
            readings: p.readings.map(String),
            mean_value: p.mean_value
          }));

          currentData = [-10, 10].map(mm =>
            mapped.find(d => d.loading_position_mm === mm) ||
            { loading_position_mm: mm, readings: Array(10).fill(""), mean_value: null }
          );

          setMeta({
            set_torque: res.data.set_torque,
            error_value: res.data.error_due_to_loading_point,
            torque_unit: res.data.torque_unit || "-"
          });
        } else {
          setMeta(prev => ({ ...prev, set_torque: res.data.set_torque, torque_unit: res.data.torque_unit || "-" }));
        }

        setTableData(currentData);

        // SYNC REFERENCE: Convert to payload string immediately
        // This ensures the auto-save effect knows "this data is already saved"
        const initialPayload = JSON.stringify({
            job_id: jobId,
            positions: currentData.map(r => ({
                loading_position_mm: r.loading_position_mm,
                readings: r.readings.map(v => (v === "" || isNaN(Number(v))) ? 0 : Number(v))
            }))
        });
        lastSavedPayload.current = initialPayload;
        
        // RESET EDIT FLAG: This data came from DB, not user
        hasUserEdited.current = false;
        
        setDataLoaded(true);

      } catch (err) {
        console.error("Failed to load Loading Point data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobId]);

  // --- 2. AUTO-SAVE EFFECT ---
  useEffect(() => {
    // 1. Safety Check: Data must be loaded
    if (!dataLoaded) return;

    // 2. STRICT GUARD: If user hasn't typed anything, DO NOT SAVE.
    // This prevents overwriting existing data with zeros on load.
    if (!hasUserEdited.current) return;

    const performAutoSave = async () => {
      const payload = {
        job_id: jobId,
        positions: debouncedTableData.map(r => ({
          loading_position_mm: r.loading_position_mm,
          readings: r.readings.map(v => (v === "" || isNaN(Number(v))) ? 0 : Number(v))
        }))
      };

      const payloadString = JSON.stringify(payload);
      
      // 3. Prevent Duplicate Saves
      if (payloadString === lastSavedPayload.current) {
        setSaveStatus("saved"); // Just visually confirm it's synced
        return;
      }

      setSaveStatus("saving");

      try {
        const res = await api.post<LoadingPointResponse>(
          "/htw-calculations/loading-point/draft", 
          payload
        );

        setMeta({
          set_torque: res.data.set_torque,
          error_value: res.data.error_due_to_loading_point,
          torque_unit: res.data.torque_unit || "-"
        });

        lastSavedPayload.current = payloadString;
        setSaveStatus("saved");
        setLastSaved(new Date());
      } catch (err) {
        console.error("Auto-save failed", err);
        setSaveStatus("error");
      }
    };

    performAutoSave();
  }, [debouncedTableData, jobId, dataLoaded]);

  // --- 3. HANDLERS ---
  const handleReadingChange = (rowIdx: number, readIdx: number, val: string) => {
    if (!/^\d*\.?\d*$/.test(val)) return;
    
    // FLAG THE EDIT
    hasUserEdited.current = true;
    
    setSaveStatus("idle");

    setTableData(prev => {
      const newData = prev.map(r => ({ ...r, readings: [...r.readings] }));
      const row = newData[rowIdx];
      row.readings[readIdx] = val;

      // Mean calculation
      const nums = row.readings.filter(r => r !== "" && !isNaN(Number(r))).map(Number);
      // Partial mean calc for UI feedback
      row.mean_value = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

      // Instant error b_l (Difference between means of -10 and +10) logic for UI
      const m1 = newData[0].mean_value;
      const m2 = newData[1].mean_value;
      
      if (m1 !== null && m2 !== null) {
          // Temporarily update UI while waiting for backend response
          setMeta(m => ({ ...m, error_value: Math.abs(m1 - m2) }));
      }

      return newData;
    });
  };

  const handleClear = () => {
    if (window.confirm("Clear all readings?")) {
      hasUserEdited.current = true; // Clearing counts as an edit
      setSaveStatus("idle");
      setTableData(prev => prev.map(r => ({ ...r, readings: Array(10).fill(""), mean_value: null })));
      setMeta(m => ({ ...m, error_value: 0 }));
    }
  };

  // --- STYLES (Unified) ---
  const thBase = "border border-gray-300 px-2 py-2 font-bold text-center align-middle bg-gray-100 text-gray-700 text-xs";
  const thUnit = "border border-gray-300 px-1 py-1 font-bold text-center align-middle bg-blue-50 text-blue-800 text-[10px]";
  const tdBase = "border border-gray-300 px-2 py-2 text-center align-middle text-gray-800 font-medium text-sm";
  const inputCell = "border border-gray-300 p-0 h-9 min-w-[50px] relative";

  if (loading && !dataLoaded) {
    return <LoadingPointSkeleton />;
  }

  return (
    <>
    <div className="flex flex-col w-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4 mt-6 mb-12">
      
      {/* HEADER */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-sm font-bold text-black uppercase tracking-tight border-l-4 border-grey-500 pl-2">
          E. Variation due to Loading Point (b<sub>l</sub>)
        </h2>

        {/* Status */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {saveStatus === "saving" && <span className="text-blue-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span>}
          {saveStatus === "saved" && <span className="text-green-600 flex items-center gap-1 transition-opacity duration-1000"><CheckCircle2 className="h-3 w-3" /> Saved <span className="text-gray-400 text-[10px] ml-1">{lastSaved?.toLocaleTimeString()}</span></span>}
          {saveStatus === "error" && <span className="text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Save Failed</span>}
          {saveStatus === "idle" && <span className="text-gray-400 flex items-center gap-1"><Cloud className="h-3 w-3" /> Up to date</span>}
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-lg border border-gray-300">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className={`${thBase} w-[100px]`}>Set Torque</th>
              <th rowSpan={2} className={`${thBase} w-[80px]`}>Position</th>
              <th colSpan={10} className={thBase}>Indicated Readings</th>
              <th rowSpan={2} className={`${thBase} w-[100px]`}>Mean</th>
            </tr>
            <tr>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <th key={n} className={thBase}>#{n}</th>)}
            </tr>
            <tr className="border-b border-gray-300">
                <th className={thUnit}>{meta.torque_unit}</th>
                <th className={thUnit}>mm</th>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <th key={n} className={thUnit}>{meta.torque_unit}</th>)}
                <th className={thUnit}>{meta.torque_unit}</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr key={row.loading_position_mm} className="hover:bg-gray-50 transition-colors">
                
                {/* SET TORQUE (Merged) */}
                {index === 0 && (
                  <td rowSpan={2} className={`${tdBase} bg-gray-50 font-bold text-lg text-gray-700 border-r border-gray-300`}>
                    {meta.set_torque}
                  </td>
                )}

                {/* POSITION */}
                <td className={`${tdBase} bg-gray-100 font-bold text-xs`}>
                  {row.loading_position_mm > 0 ? `+${row.loading_position_mm}` : row.loading_position_mm} mm
                </td>

                {/* READINGS */}
                {row.readings.map((val, cIndex) => (
                  <td key={cIndex} className={inputCell}>
                    <input 
                      type="text"
                      value={val}
                      onChange={(e) => handleReadingChange(index, cIndex, e.target.value)}
                      className="w-full h-full text-center text-xs font-medium focus:outline-none bg-white text-black hover:bg-gray-50 focus:bg-blue-50 focus:text-blue-900 placeholder-gray-200"
                      placeholder="-"
                    />
                  </td>
                ))}

                {/* MEAN */}
                <td className={`${tdBase} font-bold bg-gray-50`}>
                  {row.mean_value !== null ? row.mean_value.toFixed(2) : "-"}
                </td>
              </tr>
            ))}

            {/* --- REQUESTED FOOTER ROW --- */}
            <tr className="bg-blue-50 border-t-2 border-grey-200">
              <td colSpan={2} className="sticky left-0 bg-blue-50 z-10"></td>
              <td colSpan={11} className="p-4 text-center">
                <div className="flex items-center justify-center gap-4 text-blue-900">
                  <span className="text-sm font-bold uppercase tracking-wide">Error due to loading point (b<sub>l</sub>):</span>
                  <span className="text-2xl font-mono font-bold bg-white px-4 py-1 rounded border border-blue-200 shadow-sm">
                    {meta.error_value !== null ? meta.error_value.toFixed(2) : "0.00"}
                  </span>
                  <span className="text-xs font-bold opacity-70">{meta.torque_unit}</span>
                </div>
              </td>
            </tr>

          </tbody>
        </table>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex justify-between items-center mt-3 h-8">
        <div className="flex gap-2">
          {tableData.some(r => r.readings.some(v => v !== "")) && (
            <button 
              onClick={handleClear}
              className="px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md flex gap-2 items-center transition-colors"
            >
              <Trash2 className="h-3 w-3"/> Clear
            </button>
          )}
        </div>
        <div className="text-[10px] text-gray-400 italic">Changes save automatically</div>
      </div>
    </div>
    
    {/* END MARKER */}
    <div className="flex items-center justify-center gap-4 my-8 opacity-50">
        <div className="h-px bg-gray-300 flex-1"></div>
        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">End of Section E</div>
        <div className="h-px bg-gray-300 flex-1"></div>
    </div>
    </>
  );
};

export default LoadingPointSection;