import React, { useState, useEffect, useMemo } from "react";
import { api, ENDPOINTS } from "../api/config";
import { Loader2, Save, Edit, Trash2 } from "lucide-react";

interface OutputDriveSectionProps {
  jobId: number;
}

interface GeometricRowData {
  position_deg: number;
  readings: string[];
  mean_value: number | null;
}

const OutputDriveSection: React.FC<OutputDriveSectionProps> = ({ jobId }) => {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  
  const [tableData, setTableData] = useState<GeometricRowData[]>([
    { position_deg: 0, readings: Array(10).fill(""), mean_value: null },
    { position_deg: 90, readings: Array(10).fill(""), mean_value: null },
    { position_deg: 180, readings: Array(10).fill(""), mean_value: null },
    { position_deg: 270, readings: Array(10).fill(""), mean_value: null },
  ]);

  const [meta, setMeta] = useState({ set_torque: 0, error_value: 0, torque_unit: "-" });
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!jobId) return;
      setLoading(true);
      try {
        const res = await api.get<any>(`${ENDPOINTS.HTW_CALCULATIONS.OUTPUT_DRIVE}/${jobId}`);
        if (res.data.status === "success" && res.data.positions.length > 0) {
            const mapped = res.data.positions.map((p: any) => ({
                position_deg: p.position_deg,
                readings: p.readings.map(String),
                mean_value: p.mean_value
            }));
            const sorted = [0, 90, 180, 270].map(deg => mapped.find((d: any) => d.position_deg === deg) || { position_deg: deg, readings: Array(10).fill(""), mean_value: null });
            setTableData(sorted);
            setMeta({ set_torque: res.data.set_torque, error_value: res.data.error_value, torque_unit: res.data.torque_unit || "-" });
            setIsSaved(true);
        } else {
             setMeta(prev => ({ ...prev, set_torque: res.data.set_torque, torque_unit: res.data.torque_unit || "-" }));
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    init();
  }, [jobId]);

  const handleReadingChange = (rowIdx: number, readIdx: number, val: string) => {
    if (isSaved) return;
    if (!/^\d*\.?\d*$/.test(val)) return;

    setTableData(prev => {
        const newData = [...prev];
        const row = { ...newData[rowIdx] };
        row.readings = [...row.readings];
        row.readings[readIdx] = val;
        
        const nums = row.readings.filter(r => r !== "" && !isNaN(Number(r))).map(Number);
        row.mean_value = nums.length === 10 ? nums.reduce((a, b) => a + b, 0) / 10 : null;
        newData[rowIdx] = row;
        
        const means = newData.map(r => r.mean_value).filter((m): m is number => m !== null);
        setMeta(m => ({ ...m, error_value: means.length === 4 ? Math.max(...means) - Math.min(...means) : 0 }));
        return newData;
    });
  };

  const handleSave = async () => {
    setCalculating(true);
    try {
        const payload = { 
            job_id: jobId, 
            positions: tableData.map(r => ({ 
                position_deg: r.position_deg, 
                readings: r.readings.map(Number) 
            })) 
        };
        const res = await api.post<any>(ENDPOINTS.HTW_CALCULATIONS.OUTPUT_DRIVE_CALCULATE, payload);
        setMeta({ set_torque: res.data.set_torque, error_value: res.data.error_value, torque_unit: res.data.torque_unit || "-" });
        setIsSaved(true);
        alert("Section C Saved!");
    } catch (err: any) { alert("Error: " + (err.response?.data?.detail || err.message)); } finally { setCalculating(false); }
  };

  const handleClear = () => {
    if(window.confirm("Clear all readings?")) {
        setTableData(prev => prev.map(r => ({ ...r, readings: Array(10).fill(""), mean_value: null })));
        setMeta(m => ({ ...m, error_value: 0 }));
    }
  };

  const isFormComplete = useMemo(() => tableData.every(r => r.readings.every(v => v !== "")), [tableData]);

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-600"/></div>;

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500 bg-white border border-gray-200 rounded-xl shadow-sm p-4 mt-6">
        
        <div className="mb-4 flex justify-between items-center">
            <h2 className="text-sm font-bold text-black uppercase tracking-tight border-l-4 border-purple-500 pl-2">
                C. Variation due to geometric effect of the output drive (b<sub>out</sub>)
            </h2>
            {isSaved && <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1 rounded-full text-xs font-bold border border-green-200"><Save className="h-3 w-3" /> Saved</div>}
        </div>

        {/* --- SCROLLABLE CONTAINER --- */}
        <div className="overflow-x-auto rounded-lg border border-gray-400 shadow-inner">
            <table className="w-full min-w-[1100px] border-collapse">
                <thead>
                    <tr className="bg-gray-100 text-[11px] font-bold text-gray-800 border-b border-gray-400 text-center">
                        {/* Sticky Columns for better UX */}
                        <th className="border-r border-gray-400 p-2 w-[100px] sticky left-0 bg-gray-100 z-10 shadow-sm">Set Torque<br/>({meta.torque_unit})</th>
                        <th className="border-r border-gray-400 p-2 w-[80px] sticky left-[100px] bg-gray-100 z-10 shadow-sm">Position</th>
                        
                        <th colSpan={10} className="border-r border-gray-400 p-2 bg-green-50 text-green-900">
                            Indicated Readings 1 - 10 ({meta.torque_unit})
                        </th>
                        <th className="p-2 w-[100px] bg-yellow-50 text-yellow-900">Mean Value</th>
                    </tr>
                </thead>
                <tbody>
                    {tableData.map((row, index) => (
                        <tr key={row.position_deg} className="border-b border-gray-300 hover:bg-gray-50">
                            {/* Merged Set Torque Cell - Sticky */}
                            {index === 0 && (
                                <td rowSpan={4} className="border-r border-gray-400 p-2 font-bold text-center text-gray-900 bg-white align-middle text-lg sticky left-0 z-10 shadow-sm">
                                    {meta.set_torque}
                                </td>
                            )}
                            
                            {/* Position Cell - Sticky */}
                            <td className={`border-r border-gray-400 p-2 font-bold text-center text-gray-700 bg-gray-50 text-xs sticky left-[100px] z-10 shadow-sm ${index === 0 ? "top-[40px]" : ""}`}>
                                {row.position_deg}°
                            </td>

                            {/* Scrollable Readings */}
                            {row.readings.map((val, cIdx) => (
                                <td key={cIdx} className="border-r border-gray-200 p-0 w-[60px] relative min-w-[60px]">
                                    <input 
                                        type="text" 
                                        value={val} 
                                        onChange={(e) => handleReadingChange(index, cIdx, e.target.value)} 
                                        disabled={isSaved} 
                                        className={`w-full h-full p-2 text-center text-xs font-medium focus:outline-none 
                                            ${isSaved 
                                                ? 'bg-transparent text-gray-600' 
                                                : 'bg-white focus:bg-blue-50 focus:ring-2 focus:ring-blue-400 inset-0'
                                            }`} 
                                        placeholder="-"
                                    />
                                </td>
                            ))}

                            {/* Mean Value */}
                            <td className="border-l border-gray-400 p-2 font-bold text-center text-gray-900 bg-yellow-50 text-sm min-w-[80px]">
                                {row.mean_value !== null ? row.mean_value.toFixed(2) : "-"}
                            </td>
                        </tr>
                    ))}
                    
                    {/* Footer Row */}
                    <tr className="bg-purple-50 border-t-2 border-purple-200">
                        {/* Sticky footer cells to align with left columns */}
                        <td colSpan={2} className="sticky left-0 bg-purple-50 z-10"></td>
                        
                        <td colSpan={11} className="p-4 text-center">
                            <div className="flex items-center justify-center gap-4 text-purple-900">
                                <span className="text-sm font-bold uppercase tracking-wide">Error due to output drive (b<sub>out</sub>):</span>
                                <span className="text-2xl font-mono font-bold bg-white px-4 py-1 rounded border border-purple-200 shadow-sm">{meta.error_value.toFixed(2)}</span>
                                <span className="text-xs font-bold opacity-70">{meta.torque_unit}</span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div className="flex justify-between items-center mt-4">
             <div className="flex gap-2">
                {!isSaved && tableData.some(r => r.readings.some(v => v !== "")) && (
                    <button onClick={handleClear} className="px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md flex gap-2 items-center"><Trash2 className="h-3 w-3"/> Clear</button>
                )}
             </div>
             {isSaved ? (
                <button onClick={() => { if(window.confirm("Unlock?")) setIsSaved(false); }} className="px-5 py-2 text-xs font-bold uppercase border border-gray-300 bg-white hover:bg-gray-50 rounded-lg flex gap-2 transition-all"><Edit className="h-3 w-3"/> Edit</button>
             ) : (
                <button onClick={handleSave} disabled={!isFormComplete || calculating} className={`px-4 py-2 text-xs font-bold uppercase rounded-lg flex gap-2 shadow-sm transition-all ${isFormComplete ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-gray-200 text-gray-400"}`}>{calculating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} Save</button>
             )}
        </div>
    </div>
  );
};

export default OutputDriveSection;