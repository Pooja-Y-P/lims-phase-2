import React, { useState, useEffect } from "react";
import { api, ENDPOINTS } from "../api/config";
import { Calculator, Loader2 } from "lucide-react";

interface RepeatabilitySectionProps {
  jobId: number;
}

interface RepeatabilityResult {
  step_percent: number;
  mean_xr: number;
  set_pressure: number;
  set_torque: number;
  corrected_standard: number;
  corrected_mean: number;
  deviation_percent: number;
  stored_readings?: number[]; // Added this to handle fetching
}

interface RepeatabilityResponse {
  job_id: number;
  status: string;
  results: RepeatabilityResult[];
}

const RepeatabilitySection: React.FC<RepeatabilitySectionProps> = ({ jobId }) => {
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);
  
  const [readings, setReadings] = useState<{ [key: number]: string[] }>({
    20: ["", "", "", "", ""],
    60: ["", "", "", "", ""],
    100: ["", "", "", "", ""]
  });

  const [results, setResults] = useState<{ [key: number]: RepeatabilityResult | null }>({
    20: null,
    60: null,
    100: null
  });

  // --- NEW: FETCH DATA ON MOUNT ---
  useEffect(() => {
    const fetchData = async () => {
        if (!jobId) return;
        setLoading(true);
        try {
            const res = await api.get<RepeatabilityResponse>(ENDPOINTS.HTW_REPEATABILITY.GET(jobId));
            
            if (res.data.status === "success" && res.data.results.length > 0) {
                const newResults: { [key: number]: RepeatabilityResult } = {};
                const newReadings: { [key: number]: string[] } = { ...readings };

                res.data.results.forEach(item => {
                    // 1. Populate Results (Set Pressure, Torque, Deviation etc.)
                    newResults[item.step_percent] = item;

                    // 2. Populate Inputs (Readings S1-S5) if they exist
                    if (item.stored_readings && item.stored_readings.length === 5) {
                        newReadings[item.step_percent] = item.stored_readings.map(String);
                    }
                });

                setResults(newResults);
                setReadings(newReadings);
                setCalculated(true);
            }
        } catch (err) {
            console.error("Failed to fetch repeatability data", err);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [jobId]);

  const areAllReadingsFilled = () => {
    const steps = [20, 60, 100];
    for (const step of steps) {
      for (const val of readings[step]) {
        if (val === "" || isNaN(Number(val))) return false;
      }
    }
    return true;
  };

  const handleReadingChange = (step: number, index: number, value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return;

    setReadings(prev => {
      const newReadings = { ...prev };
      newReadings[step] = [...prev[step]];
      newReadings[step][index] = value;
      return newReadings;
    });
    
    if (calculated) setCalculated(false);
  };

  const handleCalculateAndSave = async () => {
    if (!areAllReadingsFilled()) return;

    setLoading(true);
    try {
      const payload = {
        job_id: jobId,
        steps: [20, 60, 100].map(step => ({
          step_percent: step,
          readings: readings[step].map(Number)
        }))
      };

      const response = await api.post<RepeatabilityResponse>(
        ENDPOINTS.HTW_REPEATABILITY.CALCULATE, 
        payload
      );

      const newResults: { [key: number]: RepeatabilityResult } = {};
      response.data.results.forEach(res => {
        newResults[res.step_percent] = res;
      });

      setResults(newResults);
      setCalculated(true);
      alert("Calculations saved successfully!");

    } catch (error: any) {
      console.error("Calculation failed", error);
      const msg = error.response?.data?.detail || "Failed to calculate repeatability.";
      alert(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Render Helpers ---
  const renderInputCell = (step: number, index: number) => (
    <td className="p-0 border border-gray-300">
      <input
        type="text"
        value={readings[step][index]}
        onChange={(e) => handleReadingChange(step, index, e.target.value)}
        className="w-full h-full p-2 text-center focus:bg-blue-50 focus:outline-none text-sm font-medium text-gray-700"
        placeholder="-"
      />
    </td>
  );

  const renderResultCell = (step: number, field: keyof RepeatabilityResult, decimals: number = 2) => {
    const val = results[step]?.[field];
    return (
      <td className="p-2 border border-gray-300 text-center bg-gray-50 text-sm font-semibold text-gray-800">
        {val !== undefined && val !== null ? Number(val).toFixed(decimals) : "-"}
      </td>
    );
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="mb-4 flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-l-4 border-orange-500 pl-2">
                A. Repeatability (ISO 6789-1)
            </h2>
             <button
                onClick={handleCalculateAndSave}
                disabled={!areAllReadingsFilled() || loading}
                className={`
                    px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-sm transition-all
                    ${areAllReadingsFilled() 
                        ? "bg-blue-600 text-white hover:bg-blue-700" 
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"}
                `}
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                {calculated ? "Re-Calculate & Save" : "Calculate & Save"}
            </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-300">
            <table className="w-full min-w-[800px] border-collapse">
                <thead>
                    <tr className="bg-gray-100 text-[10px] font-bold text-gray-700 uppercase tracking-tight text-center">
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[60px]">Steps %</th>
                        <th className="border border-gray-300 p-2 w-[80px]">Set Pressure</th>
                        <th className="border border-gray-300 p-2 w-[80px]">Set Torque</th>
                        <th colSpan={5} className="border border-gray-300 p-2 bg-green-50 text-green-800">Indicated Reading (Tstd)</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[80px]">Mean (Xr)</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[80px]">Corr. Std</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[80px]">Corr. Mean</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[70px]">Dev %</th>
                        <th rowSpan={2} className="border border-gray-300 p-2 w-[70px]">Tol</th>
                    </tr>
                    <tr className="bg-gray-50 text-[9px] font-bold text-gray-600 text-center">
                        <th className="border border-gray-300 p-2">Ps (bar)</th>
                        <th className="border border-gray-300 p-2">Ts (Nm)</th>
                        <th className="border border-gray-300 p-2 bg-green-50">S1</th>
                        <th className="border border-gray-300 p-2 bg-green-50">S2</th>
                        <th className="border border-gray-300 p-2 bg-green-50">S3</th>
                        <th className="border border-gray-300 p-2 bg-green-50">S4</th>
                        <th className="border border-gray-300 p-2 bg-green-50">S5</th>
                    </tr>
                </thead>
                <tbody>
                    {[20, 60, 100].map((step) => (
                        <tr key={step} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-2 border border-gray-300 font-bold text-center text-gray-700 bg-gray-50">{step}</td>
                            {/* The API returns 'set_pressure' and 'set_torque', so these will now populate */}
                            {renderResultCell(step, 'set_pressure', 0)}
                            {renderResultCell(step, 'set_torque', 0)}
                            {renderInputCell(step, 0)}
                            {renderInputCell(step, 1)}
                            {renderInputCell(step, 2)}
                            {renderInputCell(step, 3)}
                            {renderInputCell(step, 4)}
                            {renderResultCell(step, 'mean_xr', 2)}
                            {renderResultCell(step, 'corrected_standard', 2)}
                            {renderResultCell(step, 'corrected_mean', 2)}
                            {(() => {
                                const dev = results[step]?.deviation_percent;
                                const isFail = dev !== undefined && Math.abs(dev) > 4;
                                return (
                                    <td className={`p-2 border border-gray-300 text-center font-bold text-sm ${isFail ? 'text-red-600 bg-red-50' : 'text-gray-800 bg-gray-50'}`}>
                                        {dev !== undefined && dev !== null ? `${Number(dev).toFixed(2)}` : "-"}
                                    </td>
                                )
                            })()}
                            <td className="p-2 border border-gray-300 text-center text-xs text-gray-500">±4%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {!calculated && (
            <div className="bg-blue-50 p-3 mt-3 text-xs text-blue-800 text-center border border-blue-100 rounded-lg">
                Enter all 15 readings above and click "Calculate & Save" to generate Mean, Deviation, and Set Pressure/Torque values.
            </div>
        )}
    </div>
  );
};

export default RepeatabilitySection;