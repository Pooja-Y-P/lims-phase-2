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

const LoadingPointSection: React.FC<LoadingPointSectionProps> = ({ jobId }) => {
  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // Critical for auto-save
  
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

        // --- SYNC REFERENCE TO PREVENT IMMEDIATE SAVE ---
        const initialPayload = {
            job_id: jobId,
            positions: currentData.map(r => ({
                loading_position_mm: r.loading_position_mm,
                readings: r.readings.map(v => (v === "" ? 0 : Number(v)))
            }))
        };
        lastSavedPayload.current = JSON.stringify(initialPayload);
        
        setDataLoaded(true); // Enable auto-save

      } catch (err) {
        console.error("Failed to load Loading Point data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobId]);

  // --- 2. AUTO-SAVE EFFECT (DRAFT) ---
  useEffect(() => {
    if (!dataLoaded) return;
    
    // Only save if user edited or data exists
    if (!hasUserEdited.current && !tableData.some(r => r.readings.some(v => v !== ""))) return;

    const performAutoSave = async () => {
      // 1. Construct Payload (Convert "" to 0)
      const payload = {
        job_id: jobId,
        positions: debouncedTableData.map(r => ({
          loading_position_mm: r.loading_position_mm,
          readings: r.readings.map(v => (v === "" ? 0 : Number(v)))
        }))
      };

      // 2. Prevent Duplicate Saves
      const payloadString = JSON.stringify(payload);
      if (payloadString === lastSavedPayload.current) {
        setSaveStatus("saved");
        return;
      }

      setSaveStatus("saving");

      try {
        // --- CALL DRAFT ENDPOINT ---
        const res = await api.post<LoadingPointResponse>(
          "/htw-calculations/loading-point/draft", // UPDATED URL
          payload
        );

        // 3. Update Meta
        setMeta({
          set_torque: res.data.set_torque,
          error_value: res.data.error_due_to_loading_point,
          torque_unit: res.data.torque_unit || "-"
        });

        // 4. Update Reference
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
    
    hasUserEdited.current = true;
    setSaveStatus("idle");

    setTableData(prev => {
      const newData = prev.map(r => ({ ...r, readings: [...r.readings] }));
      const row = newData[rowIdx];
      row.readings[readIdx] = val;

      // Mean calculation even for partial readings (Instant UI feedback)
      const nums = row.readings.filter(r => r !== "").map(Number);
      row.mean_value = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

      // Instant error b_l (Instant UI feedback)
      const m1 = newData[0].mean_value ?? 0;
      const m2 = newData[1].mean_value ?? 0;
      setMeta(m => ({ ...m, error_value: Math.abs(m1 - m2) }));

      return newData;
    });
  };

  const handleClear = () => {
    if (window.confirm("Clear all readings?")) {
      hasUserEdited.current = true;
      setSaveStatus("idle"); // Trigger auto-save to clear backend
      setTableData(prev => prev.map(r => ({ ...r, readings: Array(10).fill(""), mean_value: null })));
      setMeta(m => ({ ...m, error_value: 0 }));
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-pink-600"/></div>;

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4 mt-6 mb-12">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-sm font-bold text-black uppercase tracking-tight border-l-4 border-pink-500 pl-2">
          E. Variation due to effect of variation of the force loading point (b<sub>l</sub>)
        </h2>

        <div className="flex items-center gap-2 text-xs font-medium">
          {saveStatus === "saving" && <span className="text-blue-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span>}
          {saveStatus === "saved" && <span className="text-green-600 flex items-center gap-1 transition-opacity duration-1000"><CheckCircle2 className="h-3 w-3" /> Saved <span className="text-gray-400 text-[10px] ml-1">{lastSaved?.toLocaleTimeString()}</span></span>}
          {saveStatus === "error" && <span className="text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Save Failed</span>}
          {saveStatus === "idle" && <span className="text-gray-400 flex items-center gap-1"><Cloud className="h-3 w-3" /> Up to date</span>}
        </div>
      </div>

      {/* Table */}
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
                {index === 0 && (
                  <td rowSpan={2} className="p-2 border border-gray-300 font-bold text-center text-gray-800 bg-white align-middle text-lg">
                    {meta.set_torque}
                  </td>
                )}
                <td className="p-2 border border-gray-300 font-bold text-center text-gray-700 bg-gray-50 text-xs">
                  {row.loading_position_mm > 0 ? `+${row.loading_position_mm}` : row.loading_position_mm} mm
                </td>
                {row.readings.map((val, cIndex) => (
                  <td key={cIndex} className="p-0 border border-gray-300 w-[50px]">
                    <input 
                      type="text"
                      value={val}
                      onChange={(e) => handleReadingChange(index, cIndex, e.target.value)}
                      className="w-full h-full p-2 text-center text-xs font-medium focus:outline-none bg-transparent text-gray-800 focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-400"
                      placeholder="-"
                    />
                  </td>
                ))}
                <td className="p-2 border border-gray-300 font-bold text-center text-gray-800 bg-gray-50 text-sm">
                  {row.mean_value !== null ? row.mean_value.toFixed(2) : "-"}
                </td>
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

      {/* Footer */}
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
  );
};

export default LoadingPointSection;