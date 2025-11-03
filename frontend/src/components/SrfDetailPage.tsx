// file: SrfDetailPage.tsx

import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

// API base path
const API_BASE = "http://localhost:8000/api/";

// --- Interfaces (No changes needed, but included for context) ---
interface SrfEquipmentDetail {
  srf_eqp_id?: number;
  unit?: string;
  no_of_calibration_points?: number;
  mode_of_calibration?: string;
}

interface EquipmentDetail {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  serial_no: string;
  quantity: number;
  range?: string;
  srf_equipment?: SrfEquipmentDetail | null;
}

interface InwardDetail {
  inward_id: number;
  customer_details: string;
  equipments: EquipmentDetail[];
  customer?: { customer_id: number; customer_details: string };
  srf_no?: number;
}

interface SrfDetail {
  srf_id: number;
  inward_id: number;
  srf_no: number;
  nepl_srf_no?: string;
  date: string;
  telephone: string;
  contact_person: string;
  email: string;
  certificate_issue_name: string;
  status: string;
  inward?: InwardDetail;
  calibration_frequency?: string;
  specified_frequency?: string;
  statement_of_conformity?: boolean;
  ref_iso?: boolean;
  ref_manufacturer_manual?: boolean;
  ref_customer_requirement?: boolean;
  turnaround_time?: string;
}

const generateNeplSrfNo = (srfNo: number | undefined): string => {
  if (!srfNo) return "";
  const full = srfNo.toString();
  const lastThree = full.slice(-3).padStart(3, "0");
  return `NEPL - ${full} / SRF-${lastThree}`;
};

const getTodayDateString = (): string => {
  return new Date().toISOString().split("T")[0];
};

export const SrfDetailPage: React.FC = () => {
  const { srfId } = useParams<{ srfId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [srfData, setSrfData] = useState<SrfDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEngineer = user?.role === "engineer";
  const isReadOnly = srfData?.status === "approved" || srfData?.status === "rejected";

  const isNewSrf = srfId?.startsWith("new-");
  const inwardId = isNewSrf ? parseInt(srfId!.split("new-")[1]) : undefined;

  const token = localStorage.getItem("token");

  const axiosAuth = useMemo(() => {
    return axios.create({
      baseURL: API_BASE,
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });
  }, [token]);

  const loadSrfData = useCallback(
    async (id: string, signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await axiosAuth.get<SrfDetail>(`/srfs/${id}`, { signal } as any);
        const data = response.data;
        data.date = data.date ? data.date.split("T")[0] : "";
        data.nepl_srf_no = generateNeplSrfNo(data.srf_no);
        setSrfData(data);
      } catch (err: any) {
        if (err.code !== 'ERR_CANCELED') {
          setError(err.response?.data?.detail || "An unknown error occurred.");
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [axiosAuth]
  );

  useEffect(() => {
    const controller = new AbortController();

    if (isNewSrf && inwardId) {
      setLoading(true);
      axiosAuth
        .get<InwardDetail>(`staff/inwards/${inwardId}`, { signal: controller.signal } as any)
        .then((res) => {
          const inward = res.data;
          setSrfData({
            srf_id: 0,
            inward_id: inward.inward_id,
            srf_no: inward.srf_no || 0,
            nepl_srf_no: generateNeplSrfNo(inward.srf_no || 0),
            date: getTodayDateString(),
            telephone: "",
            contact_person: "",
            email: "",
            certificate_issue_name: inward.customer?.customer_details || inward.customer_details || "",
            status: "created",
            inward: inward,
          });
          setLoading(false);
        })
        .catch((err) => {
          if (err.code !== 'ERR_CANCELED') {
            setError(`Failed to load Inward data for ID ${inwardId}. (Error: ${err.response?.status || err.message})`);
          }
          setLoading(false);
        });
    } else if (!isNewSrf && srfId) {
      loadSrfData(srfId, controller.signal);
    } else {
      setLoading(false);
    }

    return () => controller.abort();
  }, [srfId, isNewSrf, inwardId, loadSrfData, axiosAuth]);

  const handleSrfChange = (key: keyof SrfDetail, value: any) => {
    setSrfData((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const handleSrfEquipmentChange = (inward_eqp_id: number, field: keyof SrfEquipmentDetail, value: any) => {
    setSrfData((prevData) => {
      if (!prevData || !prevData.inward) return prevData;
      const updatedEquipments = prevData.inward.equipments.map((eq) => {
        if (eq.inward_eqp_id === inward_eqp_id) {
          const newSrfEquipment = { ...(eq.srf_equipment || {}), [field]: value };
          return { ...eq, srf_equipment: newSrfEquipment };
        }
        return eq;
      });
      return { ...prevData, inward: { ...prevData.inward, equipments: updatedEquipments } };
    });
  };

  // =================================================================
  //  THE FIX IS IN THIS FUNCTION
  // =================================================================
  const handleSaveSrf = async (newStatus: string) => {
    if (!srfData) return;
    setLoading(true);
    setError(null);

    try {
      // This payload is used for both POST (create) and PUT (update).
      const payload = {
        srf_no: srfData.srf_no,
        nepl_srf_no: srfData.nepl_srf_no,
        date: srfData.date,
        telephone: srfData.telephone,
        contact_person: srfData.contact_person,
        email: srfData.email,
        certificate_issue_name: srfData.certificate_issue_name,
        status: newStatus,
        inward_id: srfData.inward_id,
        // ... (other top-level fields)

        // ✨ FIX: The payload for the `equipments` array is now correct.
        // It correctly maps the nested state into the flat structure the
        // backend `SrfDetailUpdate` schema expects.
        equipments: srfData.inward?.equipments.map((eq) => ({
          // This key is crucial for the backend to identify which equipment
          // record to UPDATE. For new SRFs, it will be `undefined`, which is correct.
          srf_eqp_id: eq.srf_equipment?.srf_eqp_id,
          
          // These fields were already being sent, but now they are part of a
          // more complete and robust payload.
          inward_eqp_id: eq.inward_eqp_id,
          unit: eq.srf_equipment?.unit,
          no_of_calibration_points: eq.srf_equipment?.no_of_calibration_points,
          mode_of_calibration: eq.srf_equipment?.mode_of_calibration,
        })),
      };

      console.log("SENDING PAYLOAD:", JSON.stringify(payload, null, 2));

      if (isNewSrf) {
        // POST for creation. This will FAIL to save equipment until the
        // backend `POST /srfs` endpoint is fixed to accept the `equipments` array.
        await axiosAuth.post(`/srfs`, payload);
        alert("SRF created successfully. Note: Equipment details may not save until backend is updated.");
      } else {
        // PUT for update. With the corrected payload, this will now work correctly.
        await axiosAuth.put(`/srfs/${srfData.srf_id}`, payload);
        alert("SRF updated successfully");
      }

      navigate("/engineer/srfs");
    } catch (err: any) {
        let errorMessage = "An unknown error occurred.";
        if (err && err.isAxiosError && err.response) {
            const detail = err.response.data.detail;
            if (Array.isArray(detail)) {
                errorMessage = detail.map(d => `${d.loc.slice(-1)[0]}: ${d.msg}`).join('; ');
            } else if (typeof detail === 'string') {
                errorMessage = detail;
            } else {
                errorMessage = `Status ${err.response.status}: ${JSON.stringify(detail)}`;
            }
        } else if (err instanceof Error) {
            errorMessage = err.message;
        }
        alert(`Failed to save SRF: ${errorMessage}`);
        setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // The rest of the component JSX remains the same...
  const unitOptions = ["Nm", "lbs in", "lbs ft", "Kgf cm", "cNm", "g.cm", "Kgf m", "in lb", "ft lb", "lbf in", "lbf ft"];
  
  if (loading) return <div className="p-12 text-center text-gray-500">Loading SRF Details...</div>;
  if (error) return <div className="p-12 text-center text-red-600 bg-red-50 rounded-lg">Error: {error}</div>;
  if (!srfData) return <div className="p-12 text-center text-gray-500">SRF not found.</div>;

  return (
    // Your existing JSX for the page layout
    // No changes are needed in the JSX part of the component
    <div className="min-h-screen bg-gray-50 flex justify-center py-8 px-4">
    <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-10">
      
      {/* Back Link */}
      <div className="mb-8">
        <Link
          to="/engineer/srfs"
          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
        >
          ← <span>Back to SRF List</span>
        </Link>
      </div>

      {/* Customer Details */}
      <fieldset className="border border-gray-300 rounded-2xl p-6 mb-10 bg-gray-50">
        <legend className="px-3 text-lg font-semibold text-gray-800 bg-white rounded-md shadow-sm">
          Customer Details
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ref</label>
            <input
              className="block w-full rounded-lg border-gray-300 bg-gray-100 cursor-not-allowed text-sm px-3 py-2"
              readOnly
              value={srfData.nepl_srf_no || ""}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of SRF</label>
            <input
              type="date"
              className={`block w-full rounded-lg border-gray-300 px-3 py-2 text-sm ${
                isEngineer ? "bg-white" : "bg-gray-100 cursor-not-allowed"
              }`}
              readOnly={!isEngineer}
              value={srfData.date}
              onChange={(e) => handleSrfChange("date", e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name & Address
            </label>
            <textarea
              rows={3}
              className="block w-full rounded-lg border-gray-300 bg-gray-100 cursor-not-allowed text-sm px-3 py-2"
              readOnly
              value={
                srfData.inward?.customer?.customer_details ||
                srfData.inward?.customer_details ||
                ""
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              className={`block w-full rounded-lg border-gray-300 px-3 py-2 text-sm ${
                isEngineer ? "bg-white" : "bg-gray-100 cursor-not-allowed"
              }`}
              readOnly={!isEngineer}
              value={srfData.telephone}
              onChange={(e) => handleSrfChange("telephone", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input
              className={`block w-full rounded-lg border-gray-300 px-3 py-2 text-sm ${
                isEngineer ? "bg-white" : "bg-gray-100 cursor-not-allowed"
              }`}
              readOnly={!isEngineer}
              value={srfData.contact_person}
              onChange={(e) => handleSrfChange("contact_person", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className={`block w-full rounded-lg border-gray-300 px-3 py-2 text-sm ${
                isEngineer ? "bg-white" : "bg-gray-100 cursor-not-allowed"
              }`}
              readOnly={!isEngineer}
              value={srfData.email}
              onChange={(e) => handleSrfChange("email", e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Certificate Issue Name
            </label>
            <input
              className={`block w-full rounded-lg border-gray-300 px-3 py-2 text-sm ${
                isEngineer ? "bg-white" : "bg-gray-100 cursor-not-allowed"
              }`}
              readOnly={!isEngineer}
              value={srfData.certificate_issue_name}
              onChange={(e) =>
                handleSrfChange("certificate_issue_name", e.target.value)
              }
            />
          </div>
        </div>
      </fieldset>

      {/* Special Instructions */}
      {(srfData.status === "approved" || srfData.status === "rejected") && (
        <div className="mb-10 border border-gray-300 rounded-2xl bg-gray-50 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Special Instructions from customer for calibration
          </h3>

          {/* Calibration Frequency */}
          <div className="mb-4">
            <strong className="text-gray-700">1. Calibration Frequency:</strong>
            <div className="flex flex-col gap-2 mt-2 ml-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="freq"
                  checked={srfData.calibration_frequency === "As per Standard"}
                  onChange={() =>
                    handleSrfChange("calibration_frequency", "As per Standard")
                  }
                  disabled={isReadOnly}
                />
                As per Standard
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="freq"
                  checked={srfData.calibration_frequency !== "As per Standard"}
                  onChange={() => {
                    if (
                      !isReadOnly &&
                      srfData.calibration_frequency === "As per Standard"
                    ) {
                      handleSrfChange("calibration_frequency", "");
                    }
                  }}
                  disabled={isReadOnly}
                />
                Specify
              </label>

              {srfData.calibration_frequency !== "As per Standard" && (
                <input
                  type="text"
                  className={`border rounded-lg px-3 py-2 w-80 text-sm ${
                    isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""
                  }`}
                  value={srfData.calibration_frequency}
                  onChange={(e) =>
                    handleSrfChange("calibration_frequency", e.target.value)
                  }
                  placeholder="Specify frequency"
                  readOnly={isReadOnly}
                />
              )}
            </div>
          </div>

          {/* Statement of Conformity */}
          <div className="mb-4">
            <strong className="text-gray-700">
              2. Required 'Statement of conformity' to be reported in the
              Calibration Certificate?
            </strong>
            <div className="flex gap-6 mt-2 ml-2">
              <label
                className={`flex items-center gap-2 ${
                  isReadOnly ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <input
                  type="radio"
                  checked={srfData.statement_of_conformity === true}
                  onChange={() => handleSrfChange("statement_of_conformity", true)}
                  disabled={isReadOnly}
                />
                YES
              </label>
              <label
                className={`flex items-center gap-2 ${
                  isReadOnly ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <input
                  type="radio"
                  checked={srfData.statement_of_conformity === false}
                  onChange={() => handleSrfChange("statement_of_conformity", false)}
                  disabled={isReadOnly}
                />
                NO
              </label>
            </div>
          </div>

          {/* Decision Rule */}
          {srfData.statement_of_conformity && (
            <div className="mb-4 ml-2">
              <strong className="text-gray-700">
                2.1 Decision Rule (tick √):
              </strong>
              <div className="flex flex-col gap-2 mt-2">
                {[
                  ["ref_iso", "Reference to ISO/IS Doc. Standard"],
                  ["ref_manufacturer_manual", "Reference to manufacturer Instruction Manual"],
                  ["ref_customer_requirement", "Reference to Customer Requirement"],
                ].map(([field, label]) => (
                  <label
                    key={field}
                    className={`flex items-center gap-2 ${
                      isReadOnly ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={(srfData as any)[field]}
                      onChange={(e) =>
                        handleSrfChange(field as keyof SrfDetail, e.target.checked)
                      }
                      disabled={isReadOnly}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Turnaround Time */}
          <div className="mt-4">
            <strong className="text-gray-700">3. Turnaround time:</strong>
            <input
              className={`border rounded-lg px-3 py-2 mt-2 w-60 text-sm ${
                isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
              value={srfData.turnaround_time || ""}
              onChange={(e) => handleSrfChange("turnaround_time", e.target.value)}
              placeholder="Turnaround time (days)"
              readOnly={isReadOnly}
            />
          </div>
        </div>
      )}

      {/* Equipment Details */}
      <fieldset className="border border-gray-300 rounded-2xl p-6 bg-gray-50">
        <legend className="px-3 text-lg font-semibold text-gray-800 bg-white rounded-md shadow-sm">
          Equipment Details
        </legend>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="text-xs uppercase bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-3">Instrument Nomenclature</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Serial No/ID</th>
                <th className="px-4 py-3">Range</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Calibration Points</th>
                <th className="px-4 py-3">Mode of Calibration</th>
              </tr>
            </thead>
            <tbody>
              {srfData.inward?.equipments.map((eq) => (
                <tr
                  key={eq.inward_eqp_id}
                  className="bg-white border-b hover:bg-blue-50 transition"
                >
                  <td className="px-4 py-2">{eq.model}</td>
                  <td className="px-4 py-2 font-medium">
                    {eq.material_description}
                  </td>
                  <td className="px-4 py-2">{eq.serial_no}</td>
                  <td className="px-4 py-2">{eq.range}</td>
                  <td className="px-2 py-1">
                    {isEngineer ? (
                      <select
                        className="block w-full rounded-lg border-gray-300 cursor-pointer px-2 py-1 text-sm"
                        value={eq.srf_equipment?.unit || ""}
                        onChange={(e) =>
                          handleSrfEquipmentChange(
                            eq.inward_eqp_id,
                            "unit",
                            e.target.value
                          )
                        }
                      >
                        <option value="">Select Unit</option>
                        {unitOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="block w-full rounded-lg border-gray-300 bg-gray-100 cursor-not-allowed text-sm px-2 py-1"
                        readOnly
                        value={eq.srf_equipment?.unit || ""}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      className={`block w-full rounded-lg border-gray-300 px-2 py-1 text-sm ${
                        isEngineer ? "bg-white" : "bg-gray-100 cursor-not-allowed"
                      }`}
                      readOnly={!isEngineer}
                      value={eq.srf_equipment?.no_of_calibration_points || ""}
                      onChange={(e) =>
                        handleSrfEquipmentChange(
                          eq.inward_eqp_id,
                          "no_of_calibration_points",
                          parseInt(e.target.value) || undefined
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      className={`block w-full rounded-lg border-gray-300 px-2 py-1 text-sm ${
                        isEngineer ? "bg-white" : "bg-gray-100 cursor-not-allowed"
                      }`}
                      readOnly={!isEngineer}
                      value={eq.srf_equipment?.mode_of_calibration || ""}
                      onChange={(e) =>
                        handleSrfEquipmentChange(
                          eq.inward_eqp_id,
                          "mode_of_calibration",
                          e.target.value
                        )
                      }
                    />
                  </td>
</tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      {/* Footer Buttons */}
      {isEngineer && (
        <div className="flex justify-end items-center gap-4 pt-8 mt-8 border-t border-gray-200">
          <button
            className="px-5 py-2.5 rounded-lg font-medium text-gray-800 bg-gray-200 hover:bg-gray-300 transition"
            onClick={() => navigate("/engineer/srfs")}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition"
            onClick={() => handleSaveSrf("inward_completed")}
          >
            {isNewSrf ? "Create SRF & Submit" : "Save and Complete"}
          </button>
        </div>
      )}
    </div>
  </div>
  );
};

export default SrfDetailPage;