import React, { useState, useEffect, useMemo, useRef } from "react";
import { api, ENDPOINTS } from "../api/config";
import { Loader2, AlertCircle, CheckCircle2, Cloud, Trash2 } from "lucide-react";
import useDebounce from "../hooks/useDebounce"; // Import your hook

interface ReproducibilitySectionProps {
  jobId: number;
  torqueUnit?: string; // Prop from parent
}

interface SequenceData {
  sequence_no: number;
  readings: string[];
  mean_xr: number | null;
}

interface BackendReproducibilityResponse {
  job_id: number;
  status: string;
  set_torque_20: number;
  error_due_to_reproducibility: number;
  torque_unit?: string; 
  unit?: string;
  pressure_unit?: string;
  sequences: {
    sequence_no: number;
    readings: number[];
    mean_xr: number;
  }[];
}

const ReproducibilitySection: React.FC<ReproducibilitySectionProps> = ({ jobId, torqueUnit }) => {
  // --- STATE ---
  const [loading, setLoading] = useState(false); // Initial load
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Auto-Save Status State
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastSavedPayload = useRef<string | null>(null);


  // Data State
  const [setTorque, setSetTorque] = useState<number | null>(null);
  const [bRep, setBRep] = useState<number | null>(null);
  const [fetchedUnit, setFetchedUnit] = useState<string | null>(null); 
  
  const [sequences, setSequences] = useState<SequenceData[]>([
    { sequence_no: 1, readings: ["", "", "", "", ""], mean_xr: null },
    { sequence_no: 2, readings: ["", "", "", "", ""], mean_xr: null },
    { sequence_no: 3, readings: ["", "", "", "", ""], mean_xr: null },
    { sequence_no: 4, readings: ["", "", "", "", ""], mean_xr: null },
  ]);

  const sequenceLabels = ["I", "II", "III", "IV"];

  // --- DEBOUNCE SETUP ---
  const debouncedSequences = useDebounce(sequences, 1000);
    const hasUserEdited = useRef(false);
  
  // --- UNIT LOGIC ---
  const displayUnit = useMemo(() => {
    if (fetchedUnit && fetchedUnit.trim() !== "") return fetchedUnit;
    if (torqueUnit && torqueUnit.trim() !== "") return torqueUnit;
    return "Nm";
  }, [fetchedUnit, torqueUnit]);

  // --- 1. INITIAL FETCH ---
  useEffect(() => {
    if (!jobId) return;
    setLoading(true);

    api.get<BackendReproducibilityResponse>(ENDPOINTS.HTW_REPRODUCIBILITY.GET(jobId))
      .then(res => {
        if (res.data.status === "success" || res.data.status === "no_data") {
          setSetTorque(res.data.set_torque_20);
          setBRep(res.data.error_due_to_reproducibility);
          
          const backendUnit = res.data.torque_unit || res.data.unit || res.data.pressure_unit;
          if (backendUnit) setFetchedUnit(backendUnit);

          if (res.data.sequences && res.data.sequences.length > 0) {
            const newSeqs = sequences.map(defaultSeq => {
              const found = res.data.sequences.find(s => s.sequence_no === defaultSeq.sequence_no);
              if (found) {
                return {
                  sequence_no: found.sequence_no,
                  readings: found.readings.map(String),
                  mean_xr: found.mean_xr
                };
              }
              return defaultSeq;
            });
            setSequences(newSeqs);
          }
          setDataLoaded(true);
          hasUserEdited.current = false;
        }
      })
      .catch(err => console.error("Failed to fetch reproducibility", err))
      .finally(() => setLoading(false));
  }, [jobId]);

  // --- 2. AUTO-SAVE EFFECT ---
useEffect(() => {
  if (!dataLoaded) return;
  if (!hasUserEdited.current) return;

  const hasAnyValue = debouncedSequences.some(seq =>
    seq.readings.some(r => r !== "")
  );
  if (!hasAnyValue) return;

  const performAutoSave = async () => {
    setSaveStatus("saving");

    try {
      const payload = {
        job_id: jobId,
        torque_unit: displayUnit,
        sequences: debouncedSequences.map(s => ({
          sequence_no: s.sequence_no,
          readings: s.readings.map(r =>
            r === "" || isNaN(Number(r)) ? 0 : Number(r)
          )
        }))
      };
      const payloadString = JSON.stringify(payload);

if (payloadString === lastSavedPayload.current) {
  setSaveStatus("saved");
  return;
}

lastSavedPayload.current = payloadString;

      const res = await api.post<BackendReproducibilityResponse>(
        ENDPOINTS.HTW_REPRODUCIBILITY.CALCULATE,
        payload
      );

      setSetTorque(res.data.set_torque_20);
      setBRep(res.data.error_due_to_reproducibility);

      const confirmedUnit = res.data.torque_unit || res.data.unit;
      if (confirmedUnit) setFetchedUnit(confirmedUnit);

      setSaveStatus("saved");
      setLastSaved(new Date());
    } catch (err) {
      console.error("Auto-save failed", err);
      setSaveStatus("error");
    }
  };

  performAutoSave();
}, [debouncedSequences, jobId]);





  // --- 3. INPUT HANDLING ---
const handleReadingChange = (seqIndex: number, readingIndex: number, value: string) => {
  if (!/^\d*\.?\d*$/.test(value)) return;

  hasUserEdited.current = true;
  setSaveStatus("idle"); // ✅ ADD THIS

  setSequences(prev => {
    const newSeqs = [...prev];
    const currentSeq = { ...newSeqs[seqIndex] };
    const newReadings = [...currentSeq.readings];

    newReadings[readingIndex] = value;
    currentSeq.readings = newReadings;

    const validNums = newReadings.filter(v => v !== "").map(Number);
    currentSeq.mean_xr =
      validNums.length === 5
        ? validNums.reduce((a, b) => a + b, 0) / 5
        : null;

    newSeqs[seqIndex] = currentSeq;

    const allMeans = newSeqs.map(s => s.mean_xr).filter(m => m !== null) as number[];
    if (allMeans.length === 4) {
      setBRep(Math.max(...allMeans) - Math.min(...allMeans));
    }

    return newSeqs;
  });
};



  const handleClear = () => {
  if (window.confirm("Clear all reproducibility readings?")) {
    hasUserEdited.current = true;   // ✅ ADD
    setSaveStatus("idle");          // ✅ ADD

    setSequences(prev =>
      prev.map(s => ({
        ...s,
        readings: ["", "", "", "", ""],
        mean_xr: null
      }))
    );
    setBRep(null);
  }
};


  // --- RENDER ---
  if (loading && !dataLoaded) {
    return (
        <div className="h-48 flex flex-col items-center justify-center text-gray-400 border border-gray-200 rounded-xl bg-gray-50 mt-6">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <span className="text-xs">Loading Reproducibility Data...</span>
        </div>
    );
  }

  const thBase = "border border-gray-300 px-2 py-2 font-bold text-center align-middle bg-gray-100 text-gray-700 text-xs";
  const thUnit = "border border-gray-300 px-1 py-1 font-bold text-center align-middle bg-blue-50 text-blue-800 text-[10px]";
  const tdBase = "border border-gray-300 px-2 py-2 text-center align-middle text-gray-800 font-medium text-sm";
  const inputCell = "border border-gray-300 p-0 h-9 w-[100px] relative";

  return (
    <>
    <div className="flex flex-col w-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4 mt-6">
      
      {/* HEADER */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-sm font-bold text-black uppercase tracking-tight border-l-4 border-orange-500 pl-2">
            B. Reproducibility
        </h2>
        
        {/* Status Indicator */}
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

      {/* TABLE */}
      <div className="overflow-x-auto rounded-lg border border-gray-300">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className={`${thBase} w-[120px]`}>Set Torque<br/><span className="font-normal text-[10px]">(20% Value)</span></th>
              <th colSpan={4} className={thBase}>Sequence (Reading Series)</th>
            </tr>
            <tr>
              {sequenceLabels.map(label => (
                <th key={label} className={thBase}>{label}</th>
              ))}
            </tr>
            <tr className="border-b border-gray-300">
              <th className={thUnit}>{displayUnit}</th>
              {sequenceLabels.map(label => (
                <th key={label} className={thUnit}>{displayUnit}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((readingIndex) => (
              <tr key={readingIndex} className="hover:bg-gray-50 transition-colors">
                {readingIndex === 0 && (
                  <td rowSpan={5} className={`${tdBase} bg-gray-50 font-bold text-lg text-gray-700 border-b border-gray-300`}>
                    {setTorque || "-"}
                  </td>
                )}
                {sequences.map((seq, seqIndex) => (
                  <td key={seq.sequence_no} className={inputCell}>
                    <input
                      type="text"
                      value={seq.readings[readingIndex]}
                      onChange={(e) => handleReadingChange(seqIndex, readingIndex, e.target.value)}
                      className="w-full h-full text-center text-sm font-medium focus:outline-none bg-white text-black hover:bg-gray-50 focus:bg-blue-50 focus:text-blue-900 placeholder-gray-200"
                      placeholder="-"
                    />
                  </td>
                ))}
              </tr>
            ))}

            <tr className="border-t-2 border-gray-300">
              <td className={`${tdBase} bg-gray-100 font-bold text-xs uppercase tracking-wider`}>Mean X̄r</td>
              {sequences.map((seq) => (
                <td key={seq.sequence_no} className={`${tdBase} font-bold bg-gray-50`}>
                  {seq.mean_xr !== null ? seq.mean_xr.toFixed(2) : "-"}
                </td>
              ))}
            </tr>

            <tr>
              <td colSpan={3} className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-600 text-xs uppercase tracking-wide bg-gray-50">
                Error due to Reproducibility (b<sub>rep</sub>)
              </td>
              <td colSpan={2} className="border border-gray-300 px-4 py-3 text-center font-bold text-lg bg-white text-blue-700">
                {bRep !== null ? `${bRep.toFixed(2)} ${displayUnit}` : "-"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex justify-between items-center mt-3 h-8">
         <div>
            {sequences.some(s => s.readings.some(r => r !== "")) && (
                 <button 
                    onClick={handleClear}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                    <Trash2 className="h-3 w-3" /> Clear
                </button>
            )}
         </div>
         <div className="text-[10px] text-gray-400 italic">
            Changes save automatically
         </div>
      </div>
    </div>
    
    <div className="flex items-center justify-center gap-4 my-8 opacity-50">
        <div className="h-px bg-gray-300 flex-1"></div>
        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">End of Section B</div>
        <div className="h-px bg-gray-300 flex-1"></div>
    </div>
    </>
  );
};

export default ReproducibilitySection;