import React, { useState, useEffect, useMemo } from "react";
import { api, ENDPOINTS } from "../api/config";
import { Loader2, Save, AlertCircle, Edit, Trash2 } from "lucide-react";

interface ReproducibilitySectionProps {
  jobId: number;
  torqueUnit?: string; // Prop from parent (fallback)
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
  // Handle variations in backend naming
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
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // State
  const [setTorque, setSetTorque] = useState<number | null>(null);
  const [bRep, setBRep] = useState<number | null>(null);
  const [fetchedUnit, setFetchedUnit] = useState<string | null>(null); // Store unit from DB
  
  // Initialize 4 Sequences
  const [sequences, setSequences] = useState<SequenceData[]>([
    { sequence_no: 1, readings: ["", "", "", "", ""], mean_xr: null },
    { sequence_no: 2, readings: ["", "", "", "", ""], mean_xr: null },
    { sequence_no: 3, readings: ["", "", "", "", ""], mean_xr: null },
    { sequence_no: 4, readings: ["", "", "", "", ""], mean_xr: null },
  ]);

  const sequenceLabels = ["I", "II", "III", "IV"];

  // LOGIC: Prefer Backend Unit -> Then Parent Prop -> Then Default "Nm"
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
          
          // ROBUST UNIT CHECK: Check all possible keys from backend
          const backendUnit = res.data.torque_unit || res.data.unit || res.data.pressure_unit;
          if (backendUnit) {
            setFetchedUnit(backendUnit);
          }

          if (res.data.sequences && res.data.sequences.length > 0) {
            setIsSaved(true);
            setBRep(res.data.error_due_to_reproducibility);
            
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
        }
      })
      .catch(err => console.error("Failed to fetch reproducibility", err))
      .finally(() => setLoading(false));
  }, [jobId]);

  // --- 2. INPUT HANDLING ---
  const handleReadingChange = (seqIndex: number, readingIndex: number, value: string) => {
    if (isSaved) return;
    if (!/^\d*\.?\d*$/.test(value)) return;

    setSequences(prev => {
      const newSeqs = [...prev];
      const currentSeq = { ...newSeqs[seqIndex] };
      const newReadings = [...currentSeq.readings];
      
      newReadings[readingIndex] = value;
      currentSeq.readings = newReadings;

      const validNums = newReadings.filter(str => str !== "").map(Number);

      if (validNums.length === 5) {
        const sum = validNums.reduce((a, b) => a + b, 0);
        currentSeq.mean_xr = sum / 5;
      } else {
        currentSeq.mean_xr = null;
      }

      newSeqs[seqIndex] = currentSeq;

      // Local Calc for UI feedback
      const allMeans = newSeqs.map(s => s.mean_xr).filter(m => m !== null) as number[];
      if (allMeans.length === 4) {
        const maxMean = Math.max(...allMeans);
        const minMean = Math.min(...allMeans);
        setBRep(maxMean - minMean);
      } else {
        setBRep(null);
      }

      return newSeqs;
    });
  };

  const isFormComplete = useMemo(() => {
    return sequences.every(s => s.readings.every(r => r !== ""));
  }, [sequences]);

  // --- 3. ACTIONS ---
  const handleSave = async () => {
    if (!isFormComplete) return;
    setCalculating(true);

    try {
      const payload = {
        job_id: jobId,
        // IMPORTANT: Send the currently displayed unit to save it to DB
        torque_unit: displayUnit, 
        sequences: sequences.map(s => ({
          sequence_no: s.sequence_no,
          readings: s.readings.map(Number)
        }))
      };

      const res = await api.post<BackendReproducibilityResponse>(
        ENDPOINTS.HTW_REPRODUCIBILITY.CALCULATE,
        payload
      );

      setSetTorque(res.data.set_torque_20);
      setBRep(res.data.error_due_to_reproducibility);
      
      // Update local state with whatever the backend confirmed
      const confirmedUnit = res.data.torque_unit || res.data.unit || res.data.pressure_unit;
      if (confirmedUnit) {
        setFetchedUnit(confirmedUnit);
      }
      
      const updatedSeqs = sequences.map(s => {
        const found = res.data.sequences.find(b => b.sequence_no === s.sequence_no);
        if(found) return { ...s, mean_xr: found.mean_xr };
        return s;
      });
      setSequences(updatedSeqs);
      setIsSaved(true);
      alert("Reproducibility Saved!");
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.detail || "Save failed"}`);
    } finally {
      setCalculating(false);
    }
  };

  const handleEdit = () => {
    if (window.confirm("Unlock to edit? Changes are not saved until you click 'Calculate & Save'.")) {
        setIsSaved(false);
    }
  };

  const handleClear = () => {
    if (isSaved) return;
    if (window.confirm("Clear all reproducibility readings?")) {
        setSequences(prev => prev.map(s => ({
            ...s,
            readings: ["", "", "", "", ""],
            mean_xr: null
        })));
        setBRep(null);
    }
  };

  if (loading && !dataLoaded) {
    return (
        <div className="h-48 flex flex-col items-center justify-center text-gray-400 border border-gray-200 rounded-xl bg-gray-50 mt-6">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <span className="text-xs">Loading Reproducibility Data...</span>
        </div>
    );
  }

  // --- STYLES ---
  const thBase = "border border-gray-300 px-2 py-2 font-bold text-center align-middle bg-gray-100 text-gray-700 text-xs";
  const thUnit = "border border-gray-300 px-1 py-1 font-bold text-center align-middle bg-blue-50 text-blue-800 text-[10px]";
  const tdBase = "border border-gray-300 px-2 py-2 text-center align-middle text-gray-800 font-medium text-sm";
  const inputCell = "border border-gray-300 p-0 h-9 w-[100px] relative";
  
  const inputStyle = `
    w-full h-full text-center text-sm font-medium focus:outline-none transition-colors
    ${isSaved 
        ? 'bg-gray-50 text-gray-500 cursor-not-allowed' 
        : 'bg-white text-black hover:bg-gray-50 focus:bg-blue-50 focus:text-blue-900 placeholder-gray-200'}
  `;

  return (
    <>
    <div className="flex flex-col w-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4 mt-6">
      
      {/* HEADER */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-sm font-bold text-black uppercase tracking-tight border-l-4 border-orange-500 pl-2">
            B. Reproducibility
        </h2>
        
        <div className="flex gap-2">
            {!isSaved && !isFormComplete && (
                <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                    <AlertCircle className="h-3 w-3" />
                    <span>Enter all 20 readings</span>
                </div>
            )}
            {isSaved && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                    <Save className="h-3 w-3" /> Saved (Read-Only)
                </div>
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
                      disabled={isSaved}
                      className={inputStyle}
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
      <div className="flex justify-between items-center mt-5">
         <div>
            {!isSaved && sequences.some(s => s.readings.some(r => r !== "")) && (
                 <button 
                    onClick={handleClear}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                    <Trash2 className="h-3 w-3" /> Clear
                </button>
            )}
         </div>
         <div>
            {isSaved ? (
                <button
                    onClick={handleEdit}
                    className="px-5 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-lg shadow-sm flex items-center gap-2"
                >
                    <Edit className="h-3 w-3" /> Edit Data
                </button>
            ) : (
                <button
                    onClick={handleSave}
                    disabled={!isFormComplete || calculating}
                    className={`
                        px-5 py-2 text-xs font-bold uppercase tracking-wider border border-black rounded-lg shadow-sm flex items-center gap-2 transition-all
                        ${isFormComplete 
                            ? "bg-black text-white hover:bg-gray-800" 
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"}
                    `}
                >
                    {calculating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    {calculating ? "Processing..." : "Calculate & Save"}
                </button>
            )}
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