import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ENDPOINTS } from "../api/config";
import RepeatabilitySection from "../components/RepeatabilitySection";
import ReproducibilitySection from "../components/ReproducibilitySection";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Lock,
  Calendar,
  ChevronRight,
  Check 
} from "lucide-react";

// --- Interfaces (No Changes) ---
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

const CalibrationPage: React.FC = () => {
  const { inwardId, equipmentId } = useParams<{ inwardId: string; equipmentId: string }>();
  const navigate = useNavigate();

  // --- States ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<InwardEquipment | null>(null);
  
  // Job Creation States
  const [jobId, setJobId] = useState<number | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  
  // Workflow State
  const [isWorksheetSaved, setIsWorksheetSaved] = useState(false);

  // Tab State: 'A' or 'B'
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');

  // Master Standards Data
  const [masterStandards, setMasterStandards] = useState<HTWMasterStandard[]>([]);
  const [manufacturerSpec, setManufacturerSpec] = useState<HTWManufacturerSpec | null>(null);
  const [allResolutions, setAllResolutions] = useState<HTWPressureGaugeResolution[]>([]);

  // Inputs
  const [masterStandardInputs, setMasterStandardInputs] = useState<MasterStandardInput>({
    standard1: {},
    standard2: {},
    standard3: {}
  });

  const [selectedStandardIds, setSelectedStandardIds] = useState<{
    standard1: number | null;
    standard2: number | null;
    standard3: number | null;
  }>({
    standard1: null,
    standard2: null,
    standard3: null
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

  // --- Effects (Data Loading) ---
  useEffect(() => {
    const initData = async () => {
      if (!inwardId || !equipmentId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const [inwardRes, standardsRes, resolutionsRes] = await Promise.all([
          api.get<InwardDetailResponse>(`${ENDPOINTS.STAFF.INWARDS}/${inwardId}`),
          api.get<HTWMasterStandard[]>(`${ENDPOINTS.HTW_MASTER_STANDARDS.LIST}?is_active=true`),
          api.get<HTWPressureGaugeResolution[]>(`${ENDPOINTS.HTW_PRESSURE_GAUGE_RESOLUTIONS.LIST}`) 
        ]);

        const fetchedResolutions = resolutionsRes.data;
        setMasterStandards(standardsRes.data);
        setAllResolutions(fetchedResolutions);

        const defaultResUnit = fetchedResolutions.length > 0 ? fetchedResolutions[0].unit : "";
        const defaultPressure = fetchedResolutions.length > 0 ? String(fetchedResolutions[0].pressure) : "";

        const foundEquipment = inwardRes.data.equipments.find(
          (eq) => eq.inward_eqp_id === Number(equipmentId)
        );

        if (!foundEquipment) {
          setError("Equipment not found.");
          setLoading(false);
          return;
        }
        setEquipment(foundEquipment);

        // Check for Existing Job
        let existingJob: HTWJobResponse | null = null;
        try {
            const jobRes = await api.get<any>(`/htw-jobs/?inward_eqp_id=${equipmentId}`);
            const jobData = jobRes.data;
            if (Array.isArray(jobData) && jobData.length > 0) {
                existingJob = jobData[0];
            } else if (jobData && typeof jobData === 'object' && jobData.job_id) {
                existingJob = jobData;
            }
        } catch (jobCheckErr) { console.warn("No existing job found."); }

        if (existingJob) {
            setJobId(existingJob.job_id);
            setIsValidated(true);
            setIsWorksheetSaved(true);

            setDeviceDetails({
                calibrationDate: existingJob.calibration_date || new Date().toISOString().split('T')[0],
                materialNomenclature: existingJob.material_nomenclature || foundEquipment.material_description || "",
                make: existingJob.make || foundEquipment.make || "",
                model: existingJob.model || foundEquipment.model || "",
                serialNo: existingJob.serial_no || foundEquipment.serial_no || "",
                range: existingJob.range_value || foundEquipment.range || "", 
                rangeUnit: existingJob.range_unit || foundEquipment.range_unit || "",
                calibrationMode: existingJob.calibration_mode || "Clockwise",
                type: existingJob.device_type || "Indicating",
                classification: existingJob.classification || "Type I Class C",
                resolutionOfPressureGauge: existingJob.resolution_pressure_gauge ? String(existingJob.resolution_pressure_gauge) : defaultPressure,
                resolutionOfPressureGaugeUnit: existingJob.resolution_unit || defaultResUnit
            });

        } else {
            // --- UPDATED: Smarter Unit Extraction ---
            let extractedRangeUnit = foundEquipment.range_unit || "";
            // If API didn't give a separate unit, try to regex it from the range string (e.g. "0-600 bar")
            if (!extractedRangeUnit && foundEquipment.range) {
                const rangeStr = foundEquipment.range.trim();
                // Match letters at end of string
                const match = rangeStr.match(/([a-zA-Z°]+)$/); 
                if (match) {
                    extractedRangeUnit = match[1];
                }
            }

            setDeviceDetails(prev => ({
                ...prev,
                materialNomenclature: foundEquipment.material_description || "",
                make: foundEquipment.make || "",
                model: foundEquipment.model || "",
                serialNo: foundEquipment.serial_no || "",
                range: foundEquipment.range || "",
                rangeUnit: extractedRangeUnit, // Use extracted unit
                resolutionOfPressureGaugeUnit: defaultResUnit,
                resolutionOfPressureGauge: defaultPressure
            }));
            setIsValidated(false);
            setIsWorksheetSaved(false);
        }

      } catch (err: any) {
        console.error("Initialization Failed:", err);
        setError("Failed to load details. Please check console.");
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [inwardId, equipmentId]);

  // Fetch Spec
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


  // --- UPDATED: Auto Range Unit & Resolution Population ---
  useEffect(() => {
    if (loading || isValidated || !manufacturerSpec) return; 

    setDeviceDetails((prev) => {
        const newState = { ...prev };
        let hasChanges = false;

        const isHydraulicTorqueWrench = prev.materialNomenclature.toUpperCase().includes("HYDRAULIC TORQUE WRENCH");

        // 1. Auto-Populate Range Unit (Only if currently empty)
        if (!prev.rangeUnit || prev.rangeUnit.trim() === "") {
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

        // 2. Auto-Populate Resolution of Pressure Gauge (Check against Spec)
        // HTW usually relies on pressure units for resolution settings
        if (manufacturerSpec.pressure_unit) {
            const specPressureUnit = manufacturerSpec.pressure_unit;

            // If current unit is different from spec (or is just the default loaded one)
            if (prev.resolutionOfPressureGaugeUnit !== specPressureUnit) {
                // Find matching resolution config
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

  }, [manufacturerSpec, deviceDetails.materialNomenclature, allResolutions, loading, isValidated]);


  // Auto Select Standards
  useEffect(() => {
    if (loading || !masterStandards.length || !deviceDetails.materialNomenclature) return;
    if (selectedStandardIds.standard1) return;

    const isHydraulicTorqueWrench = deviceDetails.materialNomenclature.toUpperCase().includes("HYDRAULIC TORQUE WRENCH");
    if (!isHydraulicTorqueWrench) return;

    let minTorque: number | null = null;
    let maxTorque: number | null = null;

    if (manufacturerSpec?.torque_20 != null && manufacturerSpec?.torque_100 != null) {
      minTorque = Number(manufacturerSpec.torque_20);
      maxTorque = Number(manufacturerSpec.torque_100);
    } else if (deviceDetails.range) {
       const rangeWithoutUnit = deviceDetails.range.replace(/\s*(Nm|bar|kg|g|lb|oz)\s*/gi, '').trim();
       const match = rangeWithoutUnit.match(/(\d+(?:\.\d+)?)\s*[-–—to]\s*(\d+(?:\.\d+)?)/i);
       if (match) { minTorque = parseFloat(match[1]); maxTorque = parseFloat(match[2]); }
    }

    if (minTorque === null || maxTorque === null || minTorque > maxTorque) return;

    const populateStandardData = (standard: HTWMasterStandard | undefined) => {
      if (!standard) return {};
      return {
        id: standard.id,
        nomenclature: standard.nomenclature || "",
        manufacturer: standard.manufacturer || "",
        model_serial_no: standard.model_serial_no || "",
        uncertainty: standard.uncertainty || undefined,
        uncertainty_unit: standard.uncertainty_unit || "",
        certificate_no: standard.certificate_no || "",
        calibration_valid_upto: standard.calibration_valid_upto || "",
        resolution: standard.resolution || undefined,
        resolution_unit: standard.resolution_unit || "",
        traceable_to_lab: standard.traceable_to_lab || ""
      };
    };

    const matchRangesAndSelectStandards = async () => {
      try {
        const matchResponse = await api.post<{ matched_nomenclatures: string[] }>(
          ENDPOINTS.HTW_NOMENCLATURE_RANGES.MATCH, 
          { min_value: minTorque!, max_value: maxTorque! }
        );

        const { matched_nomenclatures } = matchResponse.data;
        const matchedStandards: HTWMasterStandard[] = [];
        
        if (matched_nomenclatures.length > 0) {
          const uniqueNomenclatures = [...new Set(matched_nomenclatures)];
          uniqueNomenclatures.forEach(nom => {
            const standard = masterStandards.find(s => s.nomenclature === nom && s.is_active);
            if (standard && !matchedStandards.find(s => s.id === standard.id)) {
              matchedStandards.push(standard);
            }
          });
        }
        
        const digitalPressureGauge = masterStandards.find(s => {
          const nom = s.nomenclature.toUpperCase();
          return nom.includes("DIGITAL PRESSURE GAUGE") && nom.includes("1000") && s.is_active;
        });

        const allCandidates: HTWMasterStandard[] = [...matchedStandards];
        if (digitalPressureGauge && !allCandidates.find(s => s.id === digitalPressureGauge.id)) {
          allCandidates.push(digitalPressureGauge);
        }

        allCandidates.sort((a, b) => {
            const nameA = a.nomenclature.toUpperCase();
            const nameB = b.nomenclature.toUpperCase();
            const isTorqueA = nameA.includes("TORQUE TRANSDUCER");
            const isTorqueB = nameB.includes("TORQUE TRANSDUCER");
            if (isTorqueA && !isTorqueB) return -1;
            if (!isTorqueA && isTorqueB) return 1;
            return 0;
        });

        const selectedStandards = allCandidates;

        if (selectedStandardIds.standard1 === null) {
            setSelectedStandardIds({
              standard1: selectedStandards[0]?.id || null,
              standard2: selectedStandards[1]?.id || null,
              standard3: selectedStandards[2]?.id || null
            });

            setMasterStandardInputs({
              standard1: populateStandardData(selectedStandards[0] || undefined),
              standard2: populateStandardData(selectedStandards[1] || undefined),
              standard3: populateStandardData(selectedStandards[2] || undefined)
            });
        }
      } catch (err) { console.error("Auto-select error", err); }
    };

    matchRangesAndSelectStandards();
  }, [deviceDetails.range, manufacturerSpec, masterStandards, deviceDetails.materialNomenclature, loading]);


  // --- Handlers ---

  const handleDeviceDetailChange = (field: keyof typeof deviceDetails, value: string) => {
    setDeviceDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleResolutionUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUnit = e.target.value;
    const matchedResolution = allResolutions.find(res => res.unit === selectedUnit);
    setDeviceDetails(prev => ({
        ...prev,
        resolutionOfPressureGaugeUnit: selectedUnit,
        resolutionOfPressureGauge: matchedResolution ? String(matchedResolution.pressure) : prev.resolutionOfPressureGauge
    }));
  };

  const handleSelectMasterStandard = (standard: 'standard1' | 'standard2' | 'standard3', standardId: string) => {
    if (!standardId) {
      setMasterStandardInputs(prev => ({ ...prev, [standard]: {} }));
      setSelectedStandardIds(prev => ({ ...prev, [standard]: null }));
      return;
    }
    const selectedStandard = masterStandards.find(s => s.id === Number(standardId));
    if (selectedStandard) {
      setSelectedStandardIds(prev => ({ ...prev, [standard]: selectedStandard.id }));
      setMasterStandardInputs(prev => ({
        ...prev,
        [standard]: {
            ...prev[standard],
            id: selectedStandard.id,
            nomenclature: selectedStandard.nomenclature || "",
            manufacturer: selectedStandard.manufacturer || "",
            model_serial_no: selectedStandard.model_serial_no || "",
            uncertainty: selectedStandard.uncertainty || undefined,
            uncertainty_unit: selectedStandard.uncertainty_unit || "",
            certificate_no: selectedStandard.certificate_no || "",
            calibration_valid_upto: selectedStandard.calibration_valid_upto || "",
            resolution: selectedStandard.resolution || undefined,
            resolution_unit: selectedStandard.resolution_unit || "",
            traceable_to_lab: selectedStandard.traceable_to_lab || ""
        }
      }));
    }
  };

  const handleMasterStandardInputChange = (standard: 'standard1' | 'standard2' | 'standard3', field: keyof HTWMasterStandard, value: string | number) => {
    setMasterStandardInputs(prev => ({
      ...prev,
      [standard]: { ...prev[standard], [field]: value }
    }));
  };

  const handleValidateAndCreate = async () => {
    if (!deviceDetails.materialNomenclature || !deviceDetails.range || !deviceDetails.make || !deviceDetails.calibrationDate) {
      alert("Missing Required Fields:\n- Date of Calibration\n- Nomenclature\n- Make\n- Range");
      return;
    }
    try {
      setValidating(true);
      const payload = {
        inward_id: Number(inwardId),
        inward_eqp_id: Number(equipmentId),
        srf_id: equipment?.srf_id || null,          
        srf_eqp_id: equipment?.srf_eqp_id || null, 
        calibration_date: deviceDetails.calibrationDate,
        nepl_id: equipment?.nepl_id || null,
        material_nomenclature: deviceDetails.materialNomenclature,
        make: deviceDetails.make,
        model: deviceDetails.model,
        serial_no: deviceDetails.serialNo,
        range_value: deviceDetails.range, 
        range_unit: deviceDetails.rangeUnit,
        calibration_mode: deviceDetails.calibrationMode,
        device_type: deviceDetails.type,
        classification: deviceDetails.classification,
        resolution_pressure_gauge: deviceDetails.resolutionOfPressureGauge,
        resolution_unit: deviceDetails.resolutionOfPressureGaugeUnit
      };

      const res = await api.post<HTWJobResponse>(ENDPOINTS.HTW_JOBS.CREATE, payload);
      setJobId(res.data.job_id);
      setIsValidated(true);
    } catch (err: any) {
      console.error(err);
      if (err.response) {
        let errorMessage = "Failed to validate and create job.";
        if (err.response.data?.detail) {
            errorMessage = typeof err.response.data.detail === 'string' 
                ? err.response.data.detail 
                : JSON.stringify(err.response.data.detail, null, 2);
        }
        alert(`Server Error (${err.response.status}):\n${errorMessage}`);
      } else {
        alert(`Error: ${err.message}`);
      }
    } finally {
      setValidating(false);
    }
  };

  const handleSaveWorksheet = async () => {
    if (!jobId) return;
    try {
      setLoading(true);
      const url = `${ENDPOINTS.HTW_JOBS.AUTO_SELECT_BASE}/${jobId}/auto-select-standards`;
      const response = await api.post(url, null, {
          params: {
            inward_eqp_id: Number(equipmentId),
            job_date: deviceDetails.calibrationDate
          }
        }
      );
      if (response.status === 200 || response.data.status === "success") {
        setIsWorksheetSaved(true);
        alert("Worksheet Saved! Proceed to calculations.");
      } else {
        alert("Saved, but unexpected response from server.");
      }
    } catch (err: any) {
      console.error("Failed to save worksheet", err);
      alert("Failed to save master standards.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate("/engineer/jobs", { state: { viewJobId: Number(inwardId) } });
  };

  // --- STYLES ---
  const labelClass = "text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 ml-0.5";
  const wrapperClass = "flex flex-col";
  const inputBase = "w-full p-2 text-sm border rounded-lg focus:outline-none shadow-sm transition-all";
  const editableInput = `${inputBase} bg-white border-gray-300 text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`;
  const groupContainer = "flex shadow-sm rounded-lg overflow-hidden";
  const groupLeft = "w-2/3 p-2 text-sm bg-gray-50 border border-gray-300 border-r-0 rounded-l-lg text-gray-900 focus:outline-none disabled:bg-gray-100";
  const groupRight = "w-1/3 p-2 text-sm bg-gray-100 border border-gray-300 rounded-r-lg text-gray-700 font-bold text-center focus:outline-none disabled:bg-gray-100";
  const groupRightSelect = "w-1/3 p-2 text-sm bg-white border border-gray-300 rounded-r-lg text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100";


  if (loading) return <div className="bg-white h-screen flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (error) return <div className="bg-white h-screen flex flex-col justify-center items-center p-8 text-center"><AlertCircle className="h-8 w-8 text-red-600 mb-2" /><p className="text-gray-600 mb-6">{error}</p><button onClick={handleBack} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Back</button></div>;
  if (!equipment) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 h-screen flex flex-col overflow-hidden">
      
      {/* --- Header (Fixed) --- */}
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
          <button onClick={handleBack} className="flex items-center gap-2 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-semibold text-gray-700 transition-colors"><ArrowLeft size={18} /> Back</button>
        </div>
      </div>

      {/* --- Scrollable Body --- */}
      <div className="flex-1 overflow-y-auto px-8 py-6 bg-white">
        
        {/* Device Specifications */}
        <div className="mb-6"><h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-l-4 border-blue-500 pl-2">Device Under Calibration</h2></div>

        {/* --- DEVICE FORM GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-12 gap-y-5 pb-8 border-b border-gray-100">
             <div className={wrapperClass}><label className={labelClass}><span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Calibration Date</span></label><input type="date" value={deviceDetails.calibrationDate} onChange={(e) => handleDeviceDetailChange('calibrationDate', e.target.value)} className={editableInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Material Nomenclature</label><input type="text" value={deviceDetails.materialNomenclature} onChange={(e) => handleDeviceDetailChange('materialNomenclature', e.target.value)} className={editableInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Make</label><input type="text" value={deviceDetails.make} onChange={(e) => handleDeviceDetailChange('make', e.target.value)} className={editableInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Model</label><input type="text" value={deviceDetails.model} onChange={(e) => handleDeviceDetailChange('model', e.target.value)} className={editableInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Device Type</label><select value={deviceDetails.type} onChange={(e) => handleDeviceDetailChange('type', e.target.value)} className={editableInput}><option value="Indicating">Indicating</option><option value="Setting">Setting</option></select></div>
             <div className={wrapperClass}><label className={labelClass}>Classification</label><input type="text" value={deviceDetails.classification} onChange={(e) => handleDeviceDetailChange('classification', e.target.value)} className={editableInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Serial No.</label><input type="text" value={deviceDetails.serialNo} onChange={(e) => handleDeviceDetailChange('serialNo', e.target.value)} className={editableInput} /></div>
             <div className={wrapperClass}><label className={labelClass}>Range</label><div className={groupContainer}><input type="text" value={deviceDetails.range} onChange={(e) => handleDeviceDetailChange('range', e.target.value)} placeholder="Min - Max" className={groupLeft} /><input type="text" value={deviceDetails.rangeUnit} onChange={(e) => handleDeviceDetailChange('rangeUnit', e.target.value)} placeholder="Unit" className={groupRight} /></div></div>
             <div className={wrapperClass}><label className={labelClass}>Resolution of Pressure Gauge</label><div className={groupContainer}><input type="text" value={deviceDetails.resolutionOfPressureGauge} readOnly placeholder="Auto-filled" className={groupLeft} /><select value={deviceDetails.resolutionOfPressureGaugeUnit} onChange={handleResolutionUnitChange} className={groupRightSelect}><option value="">Select Unit</option>{allResolutions.map((res, index) => (<option key={`${res.unit}-${index}`} value={res.unit}>{res.unit}</option>))}</select></div></div>
             <div className={wrapperClass}><label className={labelClass}>Calibration Mode</label><select value={deviceDetails.calibrationMode} onChange={(e) => handleDeviceDetailChange('calibrationMode', e.target.value)} className={editableInput}><option value="Clockwise">Clockwise</option><option value="Anti Clockwise">Anti Clockwise</option></select></div>
        </div>

        {!isValidated && (
            <div className="flex justify-end pt-6 pb-6"><button onClick={handleValidateAndCreate} disabled={validating} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2">{validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Validate & Create Job</button></div>
        )}

        {/* --- DYNAMIC STACKED VIEW --- */}
        {isValidated && jobId && (
            <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* 1. MASTER STANDARDS (Full Width) */}
                <div>
                    <div className="mb-4">
                        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-l-4 border-purple-500 pl-2">
                            Master Standard Details
                        </h2>
                    </div>
                    
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-200">
                                        <th className="px-4 py-3 font-bold w-1/5">Field</th>
                                        {['standard1', 'standard2', 'standard3'].map((stdKey, idx) => (
                                            <th key={stdKey} className="px-4 py-3 font-bold w-1/4 min-w-[200px]">
                                                <div className="flex flex-col gap-1.5">
                                                    <span>Standard {idx + 1}</span>
                                                    <select
                                                        onChange={(e) => handleSelectMasterStandard(stdKey as any, e.target.value)}
                                                        value={selectedStandardIds[stdKey as keyof typeof selectedStandardIds] || ""}
                                                        className={editableInput}
                                                    >
                                                        <option value="">-- Select --</option>
                                                        {masterStandards.map((std) => (
                                                            <option key={std.id} value={std.id}>{std.nomenclature} {std.model_serial_no ? `(${std.model_serial_no})` : ""}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {[
                                        { label: "Nomenclature", field: "nomenclature" },
                                        { label: "Manufacturer", field: "manufacturer" },
                                        { label: "Model/Serial", field: "model_serial_no" },
                                        { label: "Certificate No", field: "certificate_no" },
                                        { label: "Traceability", field: "traceable_to_lab" }
                                    ].map((row) => (
                                        <tr key={row.field} className="hover:bg-gray-50/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-700 text-xs uppercase bg-gray-50/20 align-top pt-4">{row.label}</td>
                                            {['standard1', 'standard2', 'standard3'].map((stdKey) => {
                                                const isTextArea = row.field === 'nomenclature' || row.field === 'traceable_to_lab';
                                                return (
                                                    <td key={stdKey} className="px-4 py-2">
                                                        {isTextArea ? (
                                                            <textarea
                                                                value={masterStandardInputs[stdKey as keyof MasterStandardInput][row.field as keyof HTWMasterStandard] as string || ""}
                                                                onChange={(e) => handleMasterStandardInputChange(stdKey as any, row.field as any, e.target.value)}
                                                                className={`${editableInput} min-h-[50px] resize-none overflow-hidden`}
                                                                rows={2}
                                                                placeholder="-"
                                                            />
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={masterStandardInputs[stdKey as keyof MasterStandardInput][row.field as keyof HTWMasterStandard] as string || ""}
                                                                onChange={(e) => handleMasterStandardInputChange(stdKey as any, row.field as any, e.target.value)}
                                                                className={editableInput}
                                                                placeholder="-"
                                                            />
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    {/* Date Row */}
                                    <tr className="hover:bg-gray-50/30">
                                        <td className="px-4 py-3 font-medium text-gray-700 text-xs uppercase bg-gray-50/20">Valid Upto</td>
                                        {['standard1', 'standard2', 'standard3'].map((stdKey) => (
                                            <td key={stdKey} className="px-4 py-2">
                                                <input
                                                    type="date"
                                                    value={masterStandardInputs[stdKey as keyof MasterStandardInput].calibration_valid_upto || ""}
                                                    onChange={(e) => handleMasterStandardInputChange(stdKey as any, 'calibration_valid_upto', e.target.value)}
                                                    className={editableInput}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                    {/* Uncertainty Row */}
                                    <tr className="hover:bg-gray-50/30">
                                        <td className="px-4 py-3 font-medium text-gray-700 text-xs uppercase bg-gray-50/20">Uncertainty</td>
                                        {['standard1', 'standard2', 'standard3'].map((stdKey) => (
                                            <td key={stdKey} className="px-4 py-2">
                                                <div className={groupContainer}>
                                                    <input
                                                        type="number" step="any"
                                                        value={masterStandardInputs[stdKey as keyof MasterStandardInput].uncertainty || ""}
                                                        onChange={(e) => handleMasterStandardInputChange(stdKey as any, 'uncertainty', e.target.value)}
                                                        className={groupLeft.replace("bg-gray-50", "bg-white")} 
                                                        placeholder="Val"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={masterStandardInputs[stdKey as keyof MasterStandardInput].uncertainty_unit || ""}
                                                        onChange={(e) => handleMasterStandardInputChange(stdKey as any, 'uncertainty_unit', e.target.value)}
                                                        className={groupRight.replace("bg-gray-100", "bg-white")}
                                                        placeholder="Unit"
                                                    />
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 2. DYNAMIC CALCULATION SECTIONS */}
                <div>
                    {isWorksheetSaved ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                            
                            {/* PROFESSIONAL STEPPER SWITCH */}
                            <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto mb-10">
                                <div className="relative flex items-center justify-between w-full">
                                    
                                    {/* Background Line */}
                                    <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-0 transform -translate-y-1/2 rounded-full"></div>
                                    
                                    {/* Active Progress Line */}
                                    <div 
                                        className="absolute left-0 top-1/2 h-1 bg-blue-600 -z-0 transform -translate-y-1/2 rounded-full transition-all duration-500 ease-in-out" 
                                        style={{ width: activeTab === 'B' ? '100%' : '0%' }}
                                    ></div>

                                    {/* STEP A */}
                                    <button 
                                        onClick={() => setActiveTab('A')}
                                        className="relative group focus:outline-none z-10"
                                    >
                                        <div className={`
                                            w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-sm transition-all duration-300
                                            ${activeTab === 'B' 
                                                ? "bg-green-600 border-green-600 text-white" // Completed state
                                                : activeTab === 'A'
                                                    ? "bg-blue-600 border-blue-600 text-white scale-110" // Active State
                                                    : "bg-white border-gray-300 text-gray-500" // Inactive (shouldn't happen here really)
                                            }
                                        `}>
                                            {activeTab === 'B' ? <Check className="h-6 w-6" /> : <span className="text-lg font-bold">A</span>}
                                        </div>
                                        <span className={`absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors duration-300 ${activeTab === 'A' ? "text-blue-700" : "text-gray-500"}`}>
                                            Repeatability
                                        </span>
                                    </button>

                                    {/* STEP B */}
                                    <button 
                                        onClick={() => setActiveTab('B')}
                                        className="relative group focus:outline-none z-10"
                                    >
                                        <div className={`
                                            w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-sm transition-all duration-300
                                            ${activeTab === 'B'
                                                ? "bg-blue-600 border-blue-600 text-white scale-110" // Active State
                                                : "bg-white border-gray-300 text-gray-400 hover:border-blue-300" // Inactive State
                                            }
                                        `}>
                                            <span className="text-lg font-bold">B</span>
                                        </div>
                                        <span className={`absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors duration-300 ${activeTab === 'B' ? "text-blue-700" : "text-gray-400"}`}>
                                            Reproducibility
                                        </span>
                                    </button>

                                </div>
                            </div>

                            {/* CONTENT AREA */}
                            <div className="mt-8">
                                {activeTab === 'A' ? (
                                    <RepeatabilitySection jobId={jobId} />
                                ) : (
                                    <ReproducibilitySection 
                                        jobId={jobId} 
                                        torqueUnit={deviceDetails.rangeUnit} 
                                    />
                                )}
                            </div>

                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center text-center p-12 transition-all">
                            <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                                <Lock className="h-8 w-8 text-gray-400" />
                            </div>
                            <h3 className="text-gray-900 font-bold mb-1">Calculations Locked</h3>
                            <p className="text-gray-500 text-sm max-w-[300px]">
                                Please confirm and save the master standards above to unlock the calculations.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        )}
      </div>

      {/* --- Footer (Fixed) --- */}
      <div className="flex-none px-8 py-5 border-t border-gray-100 flex justify-end gap-4 bg-gray-50">
        <button onClick={handleBack} className="px-5 py-2 text-sm text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors border border-gray-300 bg-white">
            Cancel
        </button>
        
        {isValidated ? (
             isWorksheetSaved ? (
                 <button onClick={handleBack} className="px-5 py-2 text-sm bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors shadow-sm flex items-center gap-2">
                     Finish / Exit <ChevronRight className="h-4 w-4" />
                 </button>
             ) : (
                 <button onClick={handleSaveWorksheet} className="px-5 py-2 text-sm bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2">
                     <Save className="h-4 w-4" /> Save Worksheet (Auto-Select)
                 </button>
             )
        ) : (
             <button className="px-5 py-2 text-sm bg-gray-300 text-white font-medium rounded-lg cursor-not-allowed flex items-center gap-2" disabled>
                 <Lock className="h-4 w-4" /> Save Worksheet
             </button>
        )}
      </div>

    </div>
  );
};

export default CalibrationPage;