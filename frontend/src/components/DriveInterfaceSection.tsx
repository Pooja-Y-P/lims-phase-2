import React, { useState, useEffect, useRef } from "react";
import { api, ENDPOINTS } from "../api/config";
import { Loader2, CheckCircle2, AlertCircle, Cloud, Trash2 } from "lucide-react";
import useDebounce from "../hooks/useDebounce"; // Ensure this path is correct

interface DriveInterfaceSectionProps {
  jobId: number;
}

interface GeometricRowData {
  position_deg: number;
  readings: string[]; // 10 readings per row
  mean_value: number | null;
}

interface DriveInterfaceResponse {
  job_id: number;
  status: string;
  set_torque: number;
  error_value: number; // b_int
  torque_unit: string;
  positions: {
    position_deg: number;
    readings: number[];
    mean_value: number;
  }[];
}

const DriveInterfaceSection: React.FC<DriveInterfaceSectionProps> = ({ jobId }) => {
  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // Critical for Auto-Save logic
  
  // Auto-Save Status
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastSavedPayload = useRef<string | null>(null);

  // Table data
  const [tableData, setTableData] = useState<GeometricRowData[]>([
    { position_deg: 0, readings: Array(10).fill(""), mean_value: null },
    { position_deg: 90, readings: Array(10).fill(""), mean_value: null },
    { position_deg: 180, readings: Array(10).fill(""), mean_value: null },
    { position_deg: 270, readings: Array(10).fill(""), mean_value: null },
  ]);

  const [meta, setMeta] = useState({ set_torque: 0, error_value: 0, torque_unit: "-" });

  // --- DEBOUNCE SETUP ---
  // Wait 1000ms after typing stops before updating this variable
  const debouncedTableData = useDebounce(tableData, 1000);
  
  // Ref to prevent initial mount trigger
  const isFirstRender = useRef(true);

  // --- 1. INITIAL FETCH ---
  useEffect(() => {
    const init = async () => {
      if (!jobId) return;
      setLoading(true);
      try {
        const res = await api.get<DriveInterfaceResponse>(`${ENDPOINTS.HTW_CALCULATIONS.DRIVE_INTERFACE}/${jobId}`);
        
        let currentData = [
          { position_deg: 0, readings: Array(10).fill(""), mean_value: null },
          { position_deg: 90, readings: Array(10).fill(""), mean_value: null },
          { position_deg: 180, readings: Array(10).fill(""), mean_value: null },
          { position_deg: 270, readings: Array(10).fill(""), mean_value: null },
        ] as GeometricRowData[];

        if (res.data.status === "success" && res.data.positions.length > 0) {
          const mappedData = res.data.positions.map(p => ({
            position_deg: p.position_deg,
            readings: p.readings.map(String),
            mean_value: p.mean_value
          }));

          currentData = [0, 90, 180, 270].map(deg =>
            mappedData.find(d => d.position_deg === deg) || { position_deg: deg, readings: Array(10).fill(""), mean_value: null }
          );

          setMeta({
            set_torque: res.data.set_torque,
            error_value: res.data.error_value,
            torque_unit: res.data.torque_unit || "-"
          });
        } else {
            // Even if empty, set meta
            setMeta(prev => ({ ...prev, set_torque: res.data.set_torque, torque_unit: res.data.torque_unit || "-" }));
        }

        setTableData(currentData);

        // --- CRITICAL FIX: SYNC REFERENCE ---
        // We calculate what the payload looks like NOW, so the Auto-Save effect 
        // knows that the data we just fetched is "clean" and doesn't need saving.
        const initialPayload = { 
          job_id: jobId, 
          positions: currentData.map(r => ({
            position_deg: r.position_deg,
            readings: r.readings.map(v => (v === "" || isNaN(Number(v))) ? 0 : Number(v))
          }))
        };
        lastSavedPayload.current = JSON.stringify(initialPayload);
        
        // Mark as loaded so the Auto-Save effect can start listening
        setDataLoaded(true);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [jobId]);

  // --- 2. AUTO-SAVE EFFECT ---
  useEffect(() => {
    // Skip if component just mounted
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Skip if we haven't finished loading data from DB yet
    if (!dataLoaded) return;

    const performAutoSave = async () => {
      // 1. Construct Payload
      const payload = { 
        job_id: jobId, 
        positions: debouncedTableData.map(r => ({
          position_deg: r.position_deg,
          // Convert empty strings to 0 for backend Pydantic validation
          readings: r.readings.map(v => (v === "" || isNaN(Number(v))) ? 0 : Number(v))
        }))
      };

      // 2. Compare with last successful save to prevent duplicate requests
      const payloadString = JSON.stringify(payload);
      if (payloadString === lastSavedPayload.current) {
        return; 
      }

      setSaveStatus("saving");

      try {
        const res = await api.post<DriveInterfaceResponse>(
          ENDPOINTS.HTW_CALCULATIONS.DRIVE_INTERFACE_CALCULATE,
          payload
        );

        // 3. Update Meta from response (Calculated Errors/Means)
        setMeta({
          set_torque: res.data.set_torque,
          error_value: res.data.error_value,
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
    
    // Visually indicate change is pending
    setSaveStatus("idle");

    setTableData(prev => {
      const newData = [...prev];
      const row = { ...newData[rowIdx] };
      row.readings = [...row.readings];
      row.readings[readIdx] = val;

      // Instant local mean calculation for UI responsiveness
      const nums = row.readings.filter(r => r !== "" && !isNaN(Number(r))).map(Number);
      row.mean_value = nums.length === 10 ? nums.reduce((a, b) => a + b, 0) / 10 : null;

      newData[rowIdx] = row;

      // Instant error calculation (b_int) for UI responsiveness
      const means = newData.map(r => r.mean_value).filter((m): m is number => m !== null);
      if (means.length === 4) {
        setMeta(m => ({ ...m, error_value: Math.max(...means) - Math.min(...means) }));
      }

      return newData;
    });
  };

  const handleClear = () => {
    if (window.confirm("Clear all readings?")) {
      setTableData(prev => prev.map(r => ({ ...r, readings: Array(10).fill(""), mean_value: null })));
      setMeta(m => ({ ...m, error_value: 0 }));
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600"/></div>;

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4 mt-6">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-sm font-bold text-black uppercase tracking-tight border-l-4 border-indigo-500 pl-2">
          D. Variation due to geometric effect of the drive interface (b<sub>int</sub>)
        </h2>

        {/* Status */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {saveStatus === "saving" && (
            <span className="text-blue-600 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-green-600 flex items-center gap-1 transition-opacity duration-1000">
              <CheckCircle2 className="h-3 w-3" /> Saved 
              <span className="text-gray-400 text-[10px] ml-1">{lastSaved?.toLocaleTimeString()}</span>
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

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-400 shadow-inner">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr className="bg-gray-100 text-[11px] font-bold text-gray-800 border-b border-gray-400 text-center">
              <th className="border-r border-gray-400 p-2 w-[100px] sticky left-0 bg-gray-100 z-10 shadow-sm">Set Torque<br/>({meta.torque_unit})</th>
              <th className="border-r border-gray-400 p-2 w-[80px] sticky left-[100px] bg-gray-100 z-10 shadow-sm">Position</th>
              <th colSpan={10} className="border-r border-gray-400 p-2 bg-green-50 text-green-900">Indicated Readings 1-10 ({meta.torque_unit})</th>
              <th className="p-2 w-[100px] bg-yellow-50 text-yellow-900">Mean Value</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr key={row.position_deg} className="border-b border-gray-300 hover:bg-gray-50">
                {index === 0 && (
                  <td rowSpan={4} className="border-r border-gray-400 p-2 font-bold text-center text-gray-900 bg-white align-middle text-lg sticky left-0 z-10 shadow-sm">
                    {meta.set_torque}
                  </td>
                )}
                <td className={`border-r border-gray-400 p-2 font-bold text-center text-gray-700 bg-gray-50 text-xs sticky left-[100px] z-10`}>
                  {row.position_deg}°
                </td>
                {row.readings.map((val, cIdx) => (
                  <td key={cIdx} className="border-r border-gray-200 p-0 w-[60px] relative min-w-[60px]">
                    <input 
                      type="text"
                      value={val}
                      onChange={e => handleReadingChange(index, cIdx, e.target.value)}
                      className="w-full h-full p-2 text-center text-xs font-medium focus:outline-none bg-transparent text-gray-800 focus:bg-blue-50 focus:ring-2 focus:ring-blue-400 inset-0"
                      placeholder="-"
                    />
                  </td>
                ))}
                <td className="border-l border-gray-400 p-2 font-bold text-center text-gray-900 bg-yellow-50 text-sm min-w-[80px]">
                  {row.mean_value !== null ? row.mean_value.toFixed(2) : "-"}
                </td>
              </tr>
            ))}

            {/* Footer Row for b_int */}
            <tr className="bg-indigo-50 border-t-2 border-indigo-200">
              <td colSpan={2} className="sticky left-0 bg-indigo-50 z-10"></td>
              <td colSpan={11} className="p-4 text-center">
                <div className="flex items-center justify-center gap-4 text-indigo-900">
                  <span className="text-sm font-bold uppercase tracking-wide">Error due to drive interface (b<sub>int</sub>):</span>
                  <span className="text-2xl font-mono font-bold bg-white px-4 py-1 rounded border border-indigo-200 shadow-sm">{meta.error_value.toFixed(2)}</span>
                  <span className="text-xs font-bold opacity-70">{meta.torque_unit}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center mt-4">
        <div className="flex gap-2">
          {tableData.some(r => r.readings.some(v => v !== "")) && (
            <button onClick={handleClear} className="px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md flex gap-2 items-center">
              <Trash2 className="h-3 w-3"/> Clear
            </button>
          )}
        </div>
        <div className="text-[10px] text-gray-400 italic">Changes save automatically</div>
      </div>
    </div>
  );
};

export default DriveInterfaceSection;