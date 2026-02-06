import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ENDPOINTS } from "../api/config";
import RepeatabilitySection from "../components/RepeatabilitySection";
import ReproducibilitySection from "../components/ReproducibilitySection";
import OutputDriveSection from "../components/OutputDriveSection";
import DriveInterfaceSection from "../components/DriveInterfaceSection";
import LoadingPointSection from "../components/LoadingPointSection";

import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Lock,
  Calendar,
  Check,
  Thermometer,
  Droplets,
  AlertTriangle,
  PlayCircle,
  Gauge,
  Activity,
  Zap,
  Anchor
} from "lucide-react";

// --- Custom CSS ---
const customStyles = `
  @keyframes fadeInSlideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-step {
    animation: fadeInSlideUp 0.4s ease-out forwards;
  }
  .ribbon-step {
    position: relative;
    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%);
    transition: all 0.3s ease-in-out;
  }
  .ribbon-step:first-child {
    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%);
    border-top-left-radius: 0.5rem;
    border-bottom-left-radius: 0.5rem;
  }
  .ribbon-step:last-child {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%);
    border-top-right-radius: 0.5rem;
    border-bottom-right-radius: 0.5rem;
  }
  .ribbon-container {
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.05));
  }
  @keyframes softPulse {
    0% { filter: brightness(1); }
    50% { filter: brightness(1.1); }
    100% { filter: brightness(1); }
  }
  .active-ribbon {
    animation: softPulse 2s infinite;
    z-index: 10;
  }
`;

// --- Interfaces ---
interface HTWJobResponse {
  job_id: number;
  inward_eqp_id: number;
  calibration_date?: string;
  material_nomenclature?: string;
  make?: string;
  model?: string;
  serial_no?: string;
  range_value?: string;
  range_unit?: string;
  calibration_mode?: string;
  device_type?: string;
  classification?: string;
  resolution_pressure_gauge?: string | number;
  resolution_unit?: string;
}

interface HTWJobStandardSnapshot {
    snapshot_id: number;
    job_id: number;
    master_standard_id: number;
    standard_order: number;
    nomenclature: string;
    manufacturer: string;
    model_serial_no: string;
    certificate_no: string;
    calibration_valid_upto: string;
    traceable_to_lab: string;
    uncertainty: number;
    uncertainty_unit: string;
    resolution?: number;
    resolution_unit?: string;
}

interface BackendStandardsResponse {
    exists: boolean;
    standards: HTWJobStandardSnapshot[];
}

interface InwardEquipment {
  inward_eqp_id: number;
  nepl_id: string;
  srf_id?: number;
  srf_eqp_id?: number;
  material_description: string;
  make: string;
  model: string;
  serial_no: string;
  range: string;
  range_unit?: string;
}

interface InwardDetailResponse {
  inward_id: number;
  equipments: InwardEquipment[];
}

interface HTWMasterStandard {
  id: number;
  nomenclature: string;
  range_min?: number;
  range_max?: number;
  range_unit?: string;
  manufacturer?: string;
  model_serial_no?: string;
  uncertainty?: number;
  uncertainty_unit?: string;
  certificate_no?: string;
  calibration_valid_upto?: string;
  resolution?: number;
  resolution_unit?: string;
  traceable_to_lab?: string;
  is_active: boolean;
}

interface MasterStandardInput {
  standard1: Partial<HTWMasterStandard>;
  standard2: Partial<HTWMasterStandard>;
  standard3: Partial<HTWMasterStandard>;
}

interface HTWManufacturerSpec {
  id: number;
  make: string;
  model: string;
  torque_20?: number;
  torque_100?: number;
  torque_unit?: string;
  pressure_unit?: string;
}

interface HTWPressureGaugeResolution {
  pressure: string | number;
  unit: string;
}

interface EnvironmentValidation {
    is_temperature_in_range: boolean;
    is_humidity_in_range: boolean;
    is_valid: boolean;
    warnings: string[];
    blocks_job_flow: boolean;
}

interface EnvironmentRecord {
    data: {
        condition_stage: "PRE" | "POST";
        ambient_temperature: number;
        relative_humidity: number;
        recorded_at: string;
    };
    validation: EnvironmentValidation;
}

const STEPS = [
    { id: 'PRE', label: 'Pre-Check', icon: Thermometer },
    { id: 'A', label: 'Repeatability', icon: Activity },
    { id: 'B', label: 'Reproducibility', icon: Gauge },
    { id: 'C', label: 'Output Drive', icon: Zap },
    { id: 'D', label: 'Drive Interface', icon: Anchor },
    { id: 'E', label: 'Loading Point', icon: PlayCircle },
    { id: 'POST', label: 'Post-Check', icon: Droplets }
] as const;

type StepId = typeof STEPS[number]['id'];

// --------------------------------------------------------------------------------
// SUB-COMPONENT: Environment Check UI
// --------------------------------------------------------------------------------
const EnvironmentCheckSection: React.FC<{
    jobId: number;
    stage: "PRE" | "POST";
    onValidationChange: (isValid: boolean) => void;
}> = ({ jobId, stage, onValidationChange }) => {
    const [temp, setTemp] = useState<string>("");
    const [humidity, setHumidity] = useState<string>("");
    const [record, setRecord] = useState<EnvironmentRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isTempValid = temp !== "" && parseFloat(temp) >= 22.0 && parseFloat(temp) <= 24.0;
    const isHumValid = humidity !== "" && parseFloat(humidity) >= 50.0 && parseFloat(humidity) <= 70.0;
    const isReadyToSubmit = temp !== "" && humidity !== "";

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await api.get<EnvironmentRecord[]>(`/staff/jobs/${jobId}/environment?condition_stage=${stage}`);
                if (res.data && res.data.length > 0) {
                    const existing = res.data[0];
                    setRecord(existing);
                    setTemp(String(existing.data.ambient_temperature));
                    setHumidity(String(existing.data.relative_humidity));
                    onValidationChange(existing.validation.is_valid);
                } else {
                    onValidationChange(false);
                }
            } catch (err) {
                console.error(`Failed to fetch ${stage} environment`, err);
            }
        };
        if (jobId) fetchStatus();
    }, [jobId, stage]);

    const handleSave = async () => {
        setError(null);
        setLoading(true);
        const payload = {
            condition_stage: stage,
            ambient_temperature: parseFloat(temp),
            temperature_unit: "°C",
            relative_humidity: parseFloat(humidity),
            humidity_unit: "%"
        };
        try {
            const res = await api.post<EnvironmentRecord>(`/staff/jobs/${jobId}/environment`, payload);
            setRecord(res.data);
            onValidationChange(res.data.validation.is_valid);
        } catch (err: any) {
            console.error(err);
            if (err.response && err.response.status === 422) {
                const detail = err.response.data.detail;
                if (detail && detail.validation && detail.validation.warnings) {
                     setError("Values out of range: " + detail.validation.warnings.join(", "));
                } else {
                    setError("Values must be: Temp 22-24°C, Humidity 50-70%");
                }
            } else if (err.response && err.response.data.detail) {
                setError(typeof err.response.data.detail === "string" ? err.response.data.detail : "Submission failed");
            } else {
                setError("Failed to save environment data.");
            }
            onValidationChange(false);
        } finally {
            setLoading(false);
        }
    };

    const isReadOnly = !!record && record.validation.is_valid;
    return (
        <div className="flex flex-col items-center justify-center py-6 animate-step">
            <div className={`w-full max-w-3xl bg-white rounded-2xl shadow-xl border overflow-hidden transition-all duration-300 ${error ? 'border-red-200 shadow-red-100' : isReadOnly ? 'border-green-200 shadow-green-100' : 'border-gray-100'}`}>
                <div className={`px-8 py-6 border-b flex items-start gap-4 ${isReadOnly ? 'bg-gradient-to-r from-green-50 to-white' : stage === 'PRE' ? 'bg-gradient-to-r from-blue-50 to-white' : 'bg-gradient-to-r from-indigo-50 to-white'}`}>
                    <div className={`p-3 rounded-xl shadow-sm ${isReadOnly ? 'bg-green-100 text-green-700' : stage === 'PRE' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {isReadOnly ? <CheckCircle className="h-8 w-8" /> : stage === 'PRE' ? <Thermometer className="h-8 w-8" /> : <Droplets className="h-8 w-8" />}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900">{stage === "PRE" ? "Pre-Calibration Environment" : "Post-Calibration Environment"}</h3>
                        <p className="text-sm text-gray-500 mt-1">{stage === 'PRE' ? "Ensure conditions are stable before starting calibration." : "Verify conditions remained stable after calibration."}</p>
                    </div>
                </div>
                <div className="p-8">
                    {error && (<div className="mb-6 flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 animate-pulse"><AlertTriangle className="h-5 w-5" /><span className="text-sm font-medium">{error}</span></div>)}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${isReadOnly ? 'border-transparent bg-gray-50' : isTempValid ? 'border-green-100 bg-green-50/30' : temp && !isTempValid ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white focus-within:border-blue-300 focus-within:shadow-md'}`}>
                            <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Temperature</label><span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">22.0 - 24.0 °C</span></div>
                            <div className="flex items-center gap-3"><Thermometer className={`h-6 w-6 ${isTempValid ? 'text-green-500' : 'text-gray-400'}`} /><input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} disabled={isReadOnly || loading} className="w-full text-2xl font-bold bg-transparent outline-none text-gray-800 placeholder-gray-300" placeholder="--" /><span className="text-sm font-medium text-gray-400">°C</span></div>
                        </div>
                        <div className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${isReadOnly ? 'border-transparent bg-gray-50' : isHumValid ? 'border-green-100 bg-green-50/30' : humidity && !isHumValid ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white focus-within:border-blue-300 focus-within:shadow-md'}`}>
                            <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Humidity</label><span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">50.0 - 70.0 %</span></div>
                            <div className="flex items-center gap-3"><Droplets className={`h-6 w-6 ${isHumValid ? 'text-green-500' : 'text-gray-400'}`} /><input type="number" step="0.1" value={humidity} onChange={(e) => setHumidity(e.target.value)} disabled={isReadOnly || loading} className="w-full text-2xl font-bold bg-transparent outline-none text-gray-800 placeholder-gray-300" placeholder="--" /><span className="text-sm font-medium text-gray-400">%</span></div>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-center">{!isReadOnly ? (<button onClick={handleSave} disabled={loading || !isReadyToSubmit} className={`relative px-8 py-3 rounded-lg font-bold text-sm shadow-md transition-all duration-300 flex items-center gap-2 ${isReadyToSubmit ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Verifying..." : "Validate & Save Conditions"}</button>) : (<div className="flex flex-col items-center animate-bounce-short"><div className="flex items-center gap-2 text-green-700 font-bold bg-green-100 px-6 py-2 rounded-full border border-green-200 shadow-sm"><CheckCircle className="h-5 w-5" /> <span>Verified Successfully</span></div></div>)}</div>
                </div>
            </div>
        </div>
    );
};

// --------------------------------------------------------------------------------
// MAIN PAGE
// --------------------------------------------------------------------------------
const CalibrationPage: React.FC = () => {
  const { inwardId, equipmentId } = useParams<{ inwardId: string; equipmentId: string }>();
  const navigate = useNavigate();

  // --- States ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<InwardEquipment | null>(null);
  
  const [jobId, setJobId] = useState<number | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [isWorksheetSaved, setIsWorksheetSaved] = useState(false);
  const [finishing, setFinishing] = useState(false);
  
  const [preEnvValid, setPreEnvValid] = useState(false);
  const [postEnvValid, setPostEnvValid] = useState(false);
  const [activeTab, setActiveTab] = useState<StepId>('PRE');

  const [manufacturerSpec, setManufacturerSpec] = useState<HTWManufacturerSpec | null>(null);
  const [allResolutions, setAllResolutions] = useState<HTWPressureGaugeResolution[]>([]);

  const [masterStandardInputs, setMasterStandardInputs] = useState<MasterStandardInput>({
    standard1: {}, standard2: {}, standard3: {}
  });

  const [deviceDetails, setDeviceDetails] = useState({
    calibrationDate: new Date().toISOString().split('T')[0],
    materialNomenclature: "",
    make: "",
    model: "",
    serialNo: "",
    range: "",
    rangeUnit: "",
    calibrationMode: "Clockwise",
    type: "Indicating",
    classification: "Type I Class C",
    resolutionOfPressureGaugeUnit: "",
    resolutionOfPressureGauge: ""
  });

  // --- 1. Helper: Fetch Saved Standards from Backend ---
  const fetchSavedStandards = async (currentJobId: number) => {
    try {
        const response = await api.get<BackendStandardsResponse>(`/jobs/${currentJobId}/auto-selected-standards`);
        const { exists, standards } = response.data;
        
        if (exists && standards.length > 0) {
            const s1 = standards.find(s => s.standard_order === 1);
            const s2 = standards.find(s => s.standard_order === 2);
            const s3 = standards.find(s => s.standard_order === 3);

            // Helper to map snapshot to UI inputs
            const mapSnapshotToInput = (snap: HTWJobStandardSnapshot | undefined): Partial<HTWMasterStandard> => {
                if (!snap) return {}; 
                return {
                    id: snap.master_standard_id,
                    nomenclature: snap.nomenclature,
                    manufacturer: snap.manufacturer,
                    model_serial_no: snap.model_serial_no,
                    certificate_no: snap.certificate_no,
                    calibration_valid_upto: snap.calibration_valid_upto,
                    traceable_to_lab: snap.traceable_to_lab,
                    uncertainty: snap.uncertainty,
                    uncertainty_unit: snap.uncertainty_unit,
                    resolution: snap.resolution,
                    resolution_unit: snap.resolution_unit
                };
            };

            setMasterStandardInputs({
                standard1: mapSnapshotToInput(s1),
                standard2: mapSnapshotToInput(s2),
                standard3: mapSnapshotToInput(s3)
            });
            setIsWorksheetSaved(true);
        }
    } catch (e) {
        console.warn("Could not fetch saved standards", e);
    }
  };

  // --- NEW: Refresh Standards Handler for Child Components ---
  const handleRefreshStandards = async () => {
    if (!jobId || !equipmentId) return;
    
    try {
      // 1. Trigger Auto-Selection in Backend (re-computes based on new steps)
      await api.post(`/jobs/${jobId}/auto-select-standards`, null, { 
          params: { 
              inward_eqp_id: Number(equipmentId), 
              job_date: deviceDetails.calibrationDate 
          } 
      });

      // 2. Refresh UI with newly selected standards
      await fetchSavedStandards(jobId);
    } catch (err) {
      console.error("Failed to auto-update standards after step change", err);
      // Optional: Add alert or toast here if critical
    }
  };

  // --- 2. Initial Data Load ---
  useEffect(() => {
    const initData = async () => {
      if (!inwardId || !equipmentId) return;
      setLoading(true);
      setError(null);
      
      try {
        // Removed fetch for HTW_MASTER_STANDARDS.LIST as manual selection is no longer used
        const [inwardRes, resolutionsRes] = await Promise.all([
          api.get<InwardDetailResponse>(`${ENDPOINTS.STAFF.INWARDS}/${inwardId}`),
          api.get<HTWPressureGaugeResolution[]>(`${ENDPOINTS.HTW_PRESSURE_GAUGE_RESOLUTIONS.LIST}`) 
        ]);

        setAllResolutions(resolutionsRes.data);
        const fetchedResolutions = resolutionsRes.data;
        const defaultResUnit = fetchedResolutions.length > 0 ? fetchedResolutions[0].unit : "";
        const defaultPressure = fetchedResolutions.length > 0 ? String(fetchedResolutions[0].pressure) : "";

        const foundEquipment = inwardRes.data.equipments.find(eq => eq.inward_eqp_id === Number(equipmentId));
        if (!foundEquipment) { setError("Equipment not found."); setLoading(false); return; }
        setEquipment(foundEquipment);

        // Check for Existing Job
        let existingJob: HTWJobResponse | null = null;
        try {
            const jobRes = await api.get<any>(`/htw-jobs/?inward_eqp_id=${equipmentId}`);
            const jobData = jobRes.data;
            if (Array.isArray(jobData) && jobData.length > 0) existingJob = jobData[0];
            else if (jobData?.job_id) existingJob = jobData;
        } catch (e) { console.warn("No existing job"); }

        if (existingJob) {
            setJobId(existingJob.job_id);
            setIsValidated(true);
            setIsWorksheetSaved(true);

            // Fetch Saved Standards
            await fetchSavedStandards(existingJob.job_id);

            // Check PRE/POST Status
            try {
                const preRes = await api.get(`/staff/jobs/${existingJob.job_id}/environment/pre-status`);
                if(preRes.data.pre_is_valid) {
                    setPreEnvValid(true);
                    const postRes = await api.get(`/staff/jobs/${existingJob.job_id}/environment/post-status`);
                    if (postRes.data.post_is_valid) {
                         setPostEnvValid(true);
                         setActiveTab('POST');
                    } else {
                         setActiveTab('A'); 
                    }
                }
            } catch(e) {}

            setDeviceDetails({
                calibrationDate: existingJob.calibration_date || new Date().toISOString().split('T')[0],
                materialNomenclature: existingJob.material_nomenclature || foundEquipment.material_description || "",
                make: existingJob.make || foundEquipment.make || "",
                model: existingJob.model || foundEquipment.model || "",
                serialNo: existingJob.serial_no || foundEquipment.serial_no || "",
                range: existingJob.range_value || foundEquipment.range || "", 
                rangeUnit: existingJob.range_unit || "", // Will trigger auto-correct if empty
                calibrationMode: existingJob.calibration_mode || "Clockwise",
                type: existingJob.device_type || "Indicating",
                classification: existingJob.classification || "Type I Class C",
                resolutionOfPressureGauge: existingJob.resolution_pressure_gauge ? String(existingJob.resolution_pressure_gauge) : defaultPressure,
                resolutionOfPressureGaugeUnit: existingJob.resolution_unit || defaultResUnit
            });
        } else {
            // New Job - Set Defaults
            let extractedRangeUnit = foundEquipment.range_unit || "";
            // FIX: Improved Regex to handle spaces like "Nm" or " Nm"
            if (!extractedRangeUnit && foundEquipment.range) {
                const match = foundEquipment.range.trim().match(/([a-zA-Z°]+)$/); 
                if (match) extractedRangeUnit = match[1];
                else {
                    // Try splitting by space
                    const parts = foundEquipment.range.trim().split(' ');
                    if (parts.length > 1) {
                         const lastPart = parts[parts.length - 1];
                         if (isNaN(Number(lastPart))) extractedRangeUnit = lastPart;
                    }
                }
            }
            setDeviceDetails(prev => ({
                ...prev,
                materialNomenclature: foundEquipment.material_description || "",
                make: foundEquipment.make || "",
                model: foundEquipment.model || "",
                serialNo: foundEquipment.serial_no || "",
                range: foundEquipment.range || "",
                rangeUnit: extractedRangeUnit, 
                resolutionOfPressureGaugeUnit: defaultResUnit,
                resolutionOfPressureGauge: defaultPressure
            }));
        }
      } catch (err) { console.error(err); setError("Init Failed"); } finally { setLoading(false); }
    };
    initData();
  }, [inwardId, equipmentId]);

  // --- Manufacturer Spec logic ---
  useEffect(() => {
    const fetchManufacturerSpec = async () => {
      if (loading || !deviceDetails.make || !deviceDetails.model) {
        setManufacturerSpec(null);
        return;
      }
      try {
        const res = await api.get<HTWManufacturerSpec[]>(`${ENDPOINTS.HTW_MANUFACTURER_SPECS.LIST}?is_active=true`);
        const matchingSpec = res.data.find(
          (spec) =>
            spec.make?.toLowerCase().trim() === deviceDetails.make.toLowerCase().trim() &&
            spec.model?.toLowerCase().trim() === deviceDetails.model.toLowerCase().trim()
        );
        setManufacturerSpec(matchingSpec || null);
      } catch (err) { console.error(err); setManufacturerSpec(null); }
    };
    fetchManufacturerSpec();
  }, [deviceDetails.make, deviceDetails.model, loading]);

  // FIX: Unit Auto-correction
  useEffect(() => {
    if (loading || !manufacturerSpec) return; 
    setDeviceDetails((prev) => {
        const newState = { ...prev };
        let hasChanges = false;
        
        // Only try to auto-fill if current unit is empty
        if (!prev.rangeUnit || prev.rangeUnit.trim() === "") {
            const isHydraulicTorqueWrench = prev.materialNomenclature.toUpperCase().includes("HYDRAULIC TORQUE WRENCH");
            let unitToUse: string | undefined;
            
            if (isHydraulicTorqueWrench && manufacturerSpec.torque_unit) {
                unitToUse = manufacturerSpec.torque_unit;
            } else if (manufacturerSpec.pressure_unit) {
                unitToUse = manufacturerSpec.pressure_unit;
            }
            
            if (unitToUse) { 
                newState.rangeUnit = unitToUse; 
                hasChanges = true; 
            }
        }
        
        // Update Resolution Unit based on spec if available
        if (manufacturerSpec.pressure_unit) {
            const specPressureUnit = manufacturerSpec.pressure_unit;
            if (prev.resolutionOfPressureGaugeUnit !== specPressureUnit) {
                const matchingRes = allResolutions.find(r => r.unit.toLowerCase() === specPressureUnit.toLowerCase());
                if (matchingRes) {
                    newState.resolutionOfPressureGaugeUnit = matchingRes.unit;
                    newState.resolutionOfPressureGauge = String(matchingRes.pressure);
                    hasChanges = true;
                }
            }
        }
        return hasChanges ? newState : prev;
    });
  }, [manufacturerSpec, deviceDetails.materialNomenclature, allResolutions, loading]);


  // --- Event Handlers ---
  const handleDeviceDetailChange = (field: keyof typeof deviceDetails, value: string) => { setDeviceDetails(prev => ({ ...prev, [field]: value })); };
  const handleResolutionUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUnit = e.target.value;
    const matchedResolution = allResolutions.find(res => res.unit === selectedUnit);
    setDeviceDetails(prev => ({ ...prev, resolutionOfPressureGaugeUnit: selectedUnit, resolutionOfPressureGauge: matchedResolution ? String(matchedResolution.pressure) : prev.resolutionOfPressureGauge }));
  };

  // --- 3. Validate & Create Job ---
  const handleValidateAndCreate = async () => {
    if (!deviceDetails.materialNomenclature || !deviceDetails.range || !deviceDetails.make || !deviceDetails.calibrationDate) { alert("Missing Required Fields"); return; }
    try {
      setValidating(true);
      const payload = { inward_id: Number(inwardId), inward_eqp_id: Number(equipmentId), srf_id: equipment?.srf_id || null, srf_eqp_id: equipment?.srf_eqp_id || null, calibration_date: deviceDetails.calibrationDate, nepl_id: equipment?.nepl_id || null, material_nomenclature: deviceDetails.materialNomenclature, make: deviceDetails.make, model: deviceDetails.model, serial_no: deviceDetails.serialNo, range_value: deviceDetails.range, range_unit: deviceDetails.rangeUnit, calibration_mode: deviceDetails.calibrationMode, device_type: deviceDetails.type, classification: deviceDetails.classification, resolution_pressure_gauge: deviceDetails.resolutionOfPressureGauge, resolution_unit: deviceDetails.resolutionOfPressureGaugeUnit };
      
      // 1. Create Job
      const res = await api.post<HTWJobResponse>(ENDPOINTS.HTW_JOBS.CREATE, payload);
      const newJobId = res.data.job_id;
      setJobId(newJobId);
      
      // 2. Auto Select Standards
      const autoSelectUrl = `/jobs/${newJobId}/auto-select-standards`;
      await api.post(autoSelectUrl, null, { 
          params: { 
              inward_eqp_id: Number(equipmentId), 
              job_date: deviceDetails.calibrationDate 
          } 
      });

      // 3. Fetch Result
      await fetchSavedStandards(newJobId);

      setIsValidated(true);
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setValidating(false); }
  };

  const handleSaveWorksheet = async () => {
    if (!jobId) return;
    try {
      setLoading(true);
      const url = `/jobs/${jobId}/auto-select-standards`;
      const response = await api.put(url, null, { 
          params: { 
              inward_eqp_id: Number(equipmentId), 
              job_date: deviceDetails.calibrationDate 
          } 
      });
      
      if (response.status === 200 || response.data.status === "recomputed") { 
          await fetchSavedStandards(jobId);
          setIsWorksheetSaved(true); 
      } 
      else { alert("Saved, but unexpected response from server."); }
    } catch (err: any) { alert("Failed to save master standards."); } finally { setLoading(false); }
  };

  const handleBack = () => { navigate("/engineer/jobs", { state: { viewJobId: Number(inwardId) } }); };

  // --- Handle Finish and Exit with Uncertainty Calculation & Status Update ---
  const handleFinishAndExit = async () => {
    if (!inwardId || !equipmentId || !jobId) return;
    
    setFinishing(true);
    try {
        // 1. Trigger Uncertainty Calculation
        await api.post("/uncertainty/uncertainity-calculation", {
            inward_id: Number(inwardId),
            inward_eqp_id: Number(equipmentId)
        });

        // 2. Update Job Status to "Calibrated"
        await api.patch(`/htw-jobs/${jobId}`, {
            job_status: "Calibrated"
        });

        // 3. Navigate back on success
        navigate("/engineer/jobs", { state: { viewJobId: Number(inwardId) } });
    } catch (err: any) {
        console.error("Finish process failed:", err);
        const errorMsg = err.response?.data?.detail 
            ? (typeof err.response.data.detail === 'object' ? JSON.stringify(err.response.data.detail) : err.response.data.detail)
            : "Failed to finish job.";
        alert(`Error: ${errorMsg}`);
    } finally {
        setFinishing(false);
    }
  };

  const goToNextStep = () => {
      const currentIndex = STEPS.findIndex(s => s.id === activeTab);
      if (activeTab === 'PRE' && !preEnvValid) {
          alert("Please validate the Pre-Check environment conditions before proceeding.");
          return;
      }
      if (currentIndex < STEPS.length - 1) {
          setActiveTab(STEPS[currentIndex + 1].id);
      }
  };

  const goToPrevStep = () => {
      const currentIndex = STEPS.findIndex(s => s.id === activeTab);
      if (currentIndex > 0) {
          setActiveTab(STEPS[currentIndex - 1].id);
      }
  };

  // --- UI RENDERING ---
  const labelClass = "text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 ml-0.5";
  const wrapperClass = "flex flex-col";
  const inputBase = "w-full p-2 text-sm border rounded-lg focus:outline-none shadow-sm transition-all";
  const editableInput = `${inputBase} bg-white border-gray-300 text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`;
  
  // New Styles for Read-Only Inputs
  const readOnlyInput = `${inputBase} bg-gray-100 text-gray-600 border-gray-300 font-medium cursor-not-allowed`;
  const groupLeftReadOnly = "w-2/3 p-2 text-sm bg-gray-100 border border-gray-300 border-r-0 rounded-l-lg text-gray-600 cursor-not-allowed focus:outline-none";
  const groupRightReadOnly = "w-1/3 p-2 text-sm bg-gray-100 border border-gray-300 rounded-r-lg text-gray-600 font-bold text-center cursor-not-allowed focus:outline-none";

  const groupContainer = "flex shadow-sm rounded-lg overflow-hidden";
  const groupLeft = "w-2/3 p-2 text-sm bg-gray-50 border border-gray-300 border-r-0 rounded-l-lg text-gray-900 focus:outline-none disabled:bg-gray-100";
  // Removed unused groupRight
  const groupRightSelect = "w-1/3 p-2 text-sm bg-white border border-gray-300 rounded-r-lg text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100";

  if (loading) return <div className="bg-white h-screen flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (error) return <div className="bg-white h-screen flex flex-col justify-center items-center p-8 text-center"><AlertCircle className="h-8 w-8 text-red-600 mb-2" /><p className="text-gray-600 mb-6">{error}</p><button onClick={handleBack} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Back</button></div>;
  if (!equipment) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 h-screen flex flex-col overflow-hidden">
      <style>{customStyles}</style>

      {/* Header */}
      <div className="flex-none px-8 py-5 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Calibration Worksheet</h1>
            <p className="text-gray-500 text-xs mt-1">HTW Calibration Process</p>
            <div className="mt-2 inline-flex items-center">
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200 mr-2">NEPL ID</span>
                <span className="text-base font-mono font-bold text-gray-800 tracking-tight">{equipment.nepl_id}</span>
                {isValidated && (<span className="ml-3 flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-100"><CheckCircle className="h-3 w-3" /> JOB CREATED</span>)}
            </div>
          </div>
          <button onClick={handleBack} className="flex items-center gap-2 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-semibold text-gray-700 transition-colors"><ArrowLeft size={18} /> Exit Job</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6 bg-white">
        <div className="mb-6"><h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-l-4 border-blue-500 pl-2">Device Under Calibration</h2></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-12 gap-y-5 pb-8 border-b border-gray-100">
             <div className={wrapperClass}><label className={labelClass}><span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Calibration Date</span></label><input type="date" value={deviceDetails.calibrationDate} onChange={(e) => handleDeviceDetailChange('calibrationDate', e.target.value)} className={editableInput} /></div>
             {/* Locked Fields */}
             <div className={wrapperClass}><label className={labelClass}>Material Nomenclature</label><input type="text" value={deviceDetails.materialNomenclature} readOnly className={readOnlyInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Make</label><input type="text" value={deviceDetails.make} readOnly className={readOnlyInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Model</label><input type="text" value={deviceDetails.model} readOnly className={readOnlyInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Device Type</label><select value={deviceDetails.type} onChange={(e) => handleDeviceDetailChange('type', e.target.value)} className={editableInput}><option value="Indicating">Indicating</option><option value="Setting">Setting</option></select></div>
             <div className={wrapperClass}><label className={labelClass}>Classification</label><input type="text" value={deviceDetails.classification} onChange={(e) => handleDeviceDetailChange('classification', e.target.value)} className={editableInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Serial No.</label><input type="text" value={deviceDetails.serialNo} readOnly className={readOnlyInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Range</label><div className={groupContainer}><input type="text" value={deviceDetails.range} readOnly placeholder="Min - Max" className={groupLeftReadOnly} /><input type="text" value={deviceDetails.rangeUnit} readOnly placeholder="Unit" className={groupRightReadOnly} /></div></div>
             <div className={wrapperClass}><label className={labelClass}>Resolution of Pressure Gauge</label><div className={groupContainer}><input type="text" value={deviceDetails.resolutionOfPressureGauge} readOnly placeholder="Auto-filled" className={groupLeft} /><select value={deviceDetails.resolutionOfPressureGaugeUnit} onChange={handleResolutionUnitChange} className={groupRightSelect}><option value="">Select Unit</option>{allResolutions.map((res, index) => (<option key={`${res.unit}-${index}`} value={res.unit}>{res.unit}</option>))}</select></div></div>
             <div className={wrapperClass}><label className={labelClass}>Calibration Mode</label><select value={deviceDetails.calibrationMode} onChange={(e) => handleDeviceDetailChange('calibrationMode', e.target.value)} className={editableInput}><option value="Clockwise">Clockwise</option><option value="Anti Clockwise">Anti Clockwise</option></select></div>
        </div>

        {!isValidated && (
            <div className="flex justify-end pt-6 pb-6"><button onClick={handleValidateAndCreate} disabled={validating} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2">{validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Validate & Create Job</button></div>
        )}

        {isValidated && jobId && (
            <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Standard Details Table */}
                <div>
                    <div className="mb-4"><h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-l-4 border-purple-500 pl-2">Master Standard Details</h2></div>
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-200">
                                        <th className="px-4 py-3 font-bold w-1/5">Field</th>
                                        {['standard1', 'standard2', 'standard3'].map((stdKey, idx) => (
                                            <th key={stdKey} className="px-4 py-3 font-bold w-1/4 min-w-[200px]">
                                                {/* Dropdown removed, replaced with static label */}
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-sm text-gray-700 font-bold">Standard {idx + 1}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {[ { label: "Nomenclature", field: "nomenclature" }, { label: "Manufacturer", field: "manufacturer" }, { label: "Model/Serial", field: "model_serial_no" }, { label: "Certificate No", field: "certificate_no" }, { label: "Traceability", field: "traceable_to_lab" } ].map((row) => (
                                        <tr key={row.field} className="hover:bg-gray-50/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-700 text-xs uppercase bg-gray-50/20 align-top pt-4">{row.label}</td>
                                            {['standard1', 'standard2', 'standard3'].map((stdKey) => {
                                                const isTextArea = row.field === 'nomenclature' || row.field === 'traceable_to_lab';
                                                return (<td key={stdKey} className="px-4 py-2">{isTextArea ? (<textarea value={masterStandardInputs[stdKey as keyof MasterStandardInput][row.field as keyof HTWMasterStandard] as string || ""} readOnly className={`${readOnlyInput} min-h-[50px] resize-none overflow-hidden`} rows={2} placeholder="-" />) : (<input type="text" value={masterStandardInputs[stdKey as keyof MasterStandardInput][row.field as keyof HTWMasterStandard] as string || ""} readOnly className={readOnlyInput} placeholder="-" />)}</td>);
                                            })}
                                        </tr>
                                    ))}
                                    <tr className="hover:bg-gray-50/30">
                                        <td className="px-4 py-3 font-medium text-gray-700 text-xs uppercase bg-gray-50/20">Valid Upto</td>
                                        {['standard1', 'standard2', 'standard3'].map((stdKey) => (<td key={stdKey} className="px-4 py-2"><input type="date" value={masterStandardInputs[stdKey as keyof MasterStandardInput].calibration_valid_upto || ""} readOnly className={readOnlyInput} /></td>))}
                                    </tr>
                                    <tr className="hover:bg-gray-50/30">
                                        <td className="px-4 py-3 font-medium text-gray-700 text-xs uppercase bg-gray-50/20">Uncertainty</td>
                                        {['standard1', 'standard2', 'standard3'].map((stdKey) => (<td key={stdKey} className="px-4 py-2"><div className={groupContainer}><input type="number" step="any" value={masterStandardInputs[stdKey as keyof MasterStandardInput].uncertainty || ""} readOnly className={groupLeftReadOnly} placeholder="Val" /><input type="text" value={masterStandardInputs[stdKey as keyof MasterStandardInput].uncertainty_unit || ""} readOnly className={groupRightReadOnly} placeholder="Unit" /></div></td>))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Workflow Steps */}
                <div>
                    {isWorksheetSaved ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                            <div className="ribbon-container flex w-full mb-8">
                                {STEPS.map((step, index) => {
                                    const currentIndex = STEPS.findIndex(s => s.id === activeTab);
                                    const isActive = step.id === activeTab;
                                    const isCompleted = index < currentIndex;
                                    let bgClass = "bg-white border-b-2 border-gray-200 text-gray-400";
                                    if (isCompleted) bgClass = "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-inner";
                                    if (isActive) bgClass = "active-ribbon bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg";

                                    return (
                                        <div key={step.id} className={`ribbon-step flex items-center justify-center flex-1 h-12 text-[10px] md:text-xs font-bold uppercase tracking-wider select-none ${bgClass} ${index !== 0 ? '-ml-3' : ''} z-${30 - index}`}>
                                            <div className="flex items-center gap-2 transform -skew-x-0">
                                                {isCompleted ? <Check size={14} strokeWidth={3} /> : <step.icon size={14} />}
                                                <span className="hidden sm:inline">{step.label}</span>
                                                <span className="sm:hidden">{step.id}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {/* FIX: Use display logic (hidden/block) instead of conditional rendering (&&) 
                                This prevents components like DriveInterface/LoadingPoint from unmounting
                                and losing their state when switching tabs before saving. */}
                            <div className="mt-8 min-h-[400px]">
                                <div className={activeTab === 'PRE' ? 'block animate-step' : 'hidden'}>
                                    <EnvironmentCheckSection jobId={jobId} stage="PRE" onValidationChange={(valid) => { setPreEnvValid(valid); if (valid) setIsWorksheetSaved(true); }} />
                                </div>
                                
                                <div className={activeTab === 'A' ? 'block animate-step' : 'hidden'}>
                                    <RepeatabilitySection 
                                        jobId={jobId} 
                                        onStepAdded={handleRefreshStandards}
                                    />
                                </div>
                                
                                <div className={activeTab === 'B' ? 'block animate-step' : 'hidden'}>
                                    <ReproducibilitySection jobId={jobId} torqueUnit={deviceDetails.rangeUnit} />
                                </div>
                                
                                <div className={activeTab === 'C' ? 'block animate-step' : 'hidden'}>
                                    <OutputDriveSection jobId={jobId} />
                                </div>
                                
                                <div className={activeTab === 'D' ? 'block animate-step' : 'hidden'}>
                                    <DriveInterfaceSection jobId={jobId} />
                                </div>
                                
                                <div className={activeTab === 'E' ? 'block animate-step' : 'hidden'}>
                                    <LoadingPointSection jobId={jobId} />
                                </div>
                                
                                <div className={activeTab === 'POST' ? 'block animate-step' : 'hidden'}>
                                    <EnvironmentCheckSection jobId={jobId} stage="POST" onValidationChange={setPostEnvValid} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center text-center p-12 transition-all">
                            <div className="bg-white p-4 rounded-full shadow-sm mb-4"><Lock className="h-8 w-8 text-gray-400" /></div>
                            <h3 className="text-gray-900 font-bold mb-1">Process Locked</h3>
                            <p className="text-gray-500 text-sm max-w-[300px]">Please confirm and save the master standards above to begin the environmental checks.</p>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-none px-8 py-5 border-t border-gray-100 flex justify-end gap-4 bg-gray-50">
        {isValidated && isWorksheetSaved ? (
            <div className="flex w-full justify-between">
                <button onClick={goToPrevStep} disabled={activeTab === 'PRE'} className="px-5 py-2 text-sm bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-100 border border-gray-300 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Previous</button>
                {activeTab === 'POST' ? (
                     <button 
                         onClick={handleFinishAndExit} 
                         disabled={finishing || !postEnvValid} 
                         className="px-6 py-2 text-sm bg-gray-900 text-white font-bold rounded-lg hover:bg-black transition-colors shadow-md flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                     >
                         {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                         {finishing ? "Calculating & Saving..." : "Finish / Exit"}
                     </button>
                ) : (
                    <button onClick={goToNextStep} className="px-6 py-2 text-sm bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2">Next Step <ArrowRight className="h-4 w-4" /></button>
                )}
            </div>
        ) : isValidated ? (
             <div className="flex w-full justify-end gap-2">
                 <button onClick={handleBack} className="px-5 py-2 text-sm text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors border border-gray-300 bg-white">Cancel</button>
                 <button onClick={handleSaveWorksheet} className="px-5 py-2 text-sm bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"><Save className="h-4 w-4" /> Save Master Standards</button>
             </div>
        ) : (
            <button className="px-5 py-2 text-sm bg-gray-300 text-white font-medium rounded-lg cursor-not-allowed flex items-center gap-2" disabled><Lock className="h-4 w-4" /> Save Worksheet</button>
        )}
      </div>
    </div>
  );
};

export default CalibrationPage;