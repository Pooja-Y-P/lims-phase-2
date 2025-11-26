import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Plus, Trash2, Eye, Save, FileText, Loader2, X, ArrowLeft, 
  Camera, Clock, Send, Wrench, AlertCircle, CheckCircle2, 
  Download, UserPlus, MapPin, Receipt, PackagePlus
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InwardForm as InwardFormType, EquipmentDetail as BaseEquipmentDetail, InwardDetail } from '../types/inward';
import { EquipmentDetailsModal } from './EquipmentDetailsModal';
import { api, ENDPOINTS, BACKEND_ROOT_URL } from '../api/config';
import { CustomerRemark } from './CustomerRemarks';
import { useAuth } from '../auth/AuthProvider';

// --- TYPE DEFINITIONS ---

interface ExtendedInwardFormType extends InwardFormType {
  customer_dc_no: string;
}

interface EquipmentDetail extends Omit<BaseEquipmentDetail, 'inspe_notes' | 'calibration_by'> {
  inspe_status: 'OK' | 'Not OK';
  inspe_remarks: string; 
  engineer_remarks?: string; 
  calibration_by: 'In Lab' | 'Outsource' | 'On-Site';
  accessories_included?: string;
  remarks_and_decision?: string | null;
}

interface CustomerDropdownItem {
  customer_id: number;
  customer_details: string;
  email?: string;
  ship_to_address?: string;
  bill_to_address?: string;
}

interface NewCustomerForm {
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  ship_to_address: string;
  bill_to_address: string;
  same_as_ship: boolean;
}

interface InwardResponse {
  inward_id: number;
  srf_no: string;
}

interface DraftSaveResponse {
  inward_id: number;
  draft_updated_at: string;
  customer_details?: string;
  draft_data: Record<string, any>;
}

interface LoadedDraftData {
  srf_no: string;
  material_inward_date: string;
  customer_dc_date: string;
  customer_dc_no: string;
  customer_id: number | null;
  customer_details: string;
  receiver: string;
  equipment_list: EquipmentDetail[];
}

interface DraftLoadResponse {
  draft_data: LoadedDraftData;
}

type InwardFormProps = {
  initialDraftId: number | null;
};

// Initial static list (Always shown)
const INITIAL_MATERIAL_DESCRIPTIONS = [
  "Hydraulic Torque Wrench",
  "Pressure Gauge",
  "Temperature Gauge",
  "Vernier Caliper",
  "Micrometer",
];

// --- HELPER: Safe Date Parsing ---
const safeDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    return dateStr.split('T')[0];
  } catch (e) {
    return '';
  }
};

// --- COMPONENT ---
export const InwardForm: React.FC<InwardFormProps> = ({ initialDraftId }) => {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEditMode = Boolean(editId);
  const { user } = useAuth();

  const [formData, setFormData] = useState<ExtendedInwardFormType>({
    srf_no: 'Loading...', 
    material_inward_date: new Date().toISOString().split('T')[0],
    customer_dc_date: '',
    customer_dc_no: '',
    receiver: user?.full_name || user?.username || '',
    customer_id: null,
    customer_details: '',
    status: 'created'
  });

  const [equipmentList, setEquipmentList] = useState<EquipmentDetail[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(isEditMode || Boolean(initialDraftId));
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals & Flow State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  
  // --- MATERIAL DESCRIPTION STATE ---
  const [materialOptions, setMaterialOptions] = useState<string[]>(INITIAL_MATERIAL_DESCRIPTIONS);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [newMaterialInput, setNewMaterialInput] = useState("");
  const [activeRowForNewMaterial, setActiveRowForNewMaterial] = useState<number | null>(null);

  const [newCustomerData, setNewCustomerData] = useState<NewCustomerForm>({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    ship_to_address: '',
    bill_to_address: '',
    same_as_ship: false
  });

  const [reportEmails, setReportEmails] = useState<string[]>(['']);
  const [lastSavedInwardId, setLastSavedInwardId] = useState<number | null>(null);
  const [lastSavedSrfNo, setLastSavedSrfNo] = useState<string>('');
  const [selectedCustomerEmail, setSelectedCustomerEmail] = useState<string>('');

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const previewUrlsRef = useRef<string[]>([]);

  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'unsaved'>('idle');
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(initialDraftId);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);

  const [customers, setCustomers] = useState<CustomerDropdownItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const selectedCustomerData = customers.find(c => c.customer_id === selectedCustomerId);

  const isFormReady = !isLoadingData && formData.srf_no !== 'Loading...';
  const isAnyOutsourced = equipmentList.some(eq => eq.calibration_by === 'Outsource');
  
  // --- CONDITIONAL COLUMN LOGIC ---
  const showEngineerRemarksColumn = isEditMode || equipmentList.some(eq => eq.inspe_status === 'Not OK' || (eq.engineer_remarks && eq.engineer_remarks.trim() !== ''));

  const hasFormData =
    (formData.customer_id !== null && formData.customer_id !== undefined) ||
    (formData.customer_dc_date ?? '').trim().length > 0 ||
    (formData.customer_dc_no ?? '').trim().length > 0 ||
    equipmentList.some((eq) => (eq.material_desc || '').trim().length > 0);

  // --- HELPER FUNCTIONS ---

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 7000);
  };

  const cleanupAllPreviews = useCallback(() => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
  }, []);

  const resolvePhotoUrl = useCallback((photo: string | undefined) => {
    if (!photo) return "";
    const sanitized = photo.replace(/\\/g, "/");
    if (/^https?:\/\//i.test(sanitized)) return sanitized;
    const normalized = sanitized.startsWith("/") ? sanitized : `/${sanitized}`;
    return `${BACKEND_ROOT_URL}${normalized}`;
  }, []);

  const serializeDraftState = useCallback(
    (payload?: { formData: ExtendedInwardFormType; equipmentList: EquipmentDetail[] }) => {
      const targetFormData = payload?.formData ?? formData;
      const targetEquipmentList = payload?.equipmentList ?? equipmentList;
      return JSON.stringify({
        formData: targetFormData,
        equipmentList: targetEquipmentList.map((equipment) => {
          const { photos, photoPreviews, existingPhotoUrls, ...rest } = equipment;
          return {
            ...rest,
            photos: (photos || []).map((file) => (file?.name ? String(file.name) : "")),
            photoPreviews: (photoPreviews || []).slice(),
            existingPhotoUrls: (existingPhotoUrls || []).slice()
          };
        })
      });
    },
    [formData, equipmentList]
  );

  // --- DATA LOADING ---

  const fetchMaterials = useCallback(async () => {
    try {
        // Fetch materials history from backend (ensure backend is running and returning data)
        const response = await api.get<string[]>(`${ENDPOINTS.STAFF.INWARDS}/materials-history?t=${Date.now()}`);
        const history = Array.isArray(response.data) ? response.data : [];
        
        setMaterialOptions(prev => {
            // 1. Combine Defaults + History + Any currently in local state
            const combined = new Set([...INITIAL_MATERIAL_DESCRIPTIONS, ...history, ...prev]);
            // 2. Convert to array, remove empty/null, sort
            return Array.from(combined).filter(Boolean).sort();
        });
    } catch (error) {
        console.error("Could not load material history from backend:", error);
        // Fallback: Just keep defaults and whatever was already there
        setMaterialOptions(prev => {
             const combined = new Set([...INITIAL_MATERIAL_DESCRIPTIONS, ...prev]);
             return Array.from(combined).filter(Boolean).sort();
        });
    }
  }, []);

  const fetchNextSrfNo = async (): Promise<string> => {
    try {
      const response = await api.get<{ next_srf_no: string }>(`${ENDPOINTS.STAFF.INWARDS}/next-no`);
      return response.data.next_srf_no;
    } catch (e) {
      return "TBD";
    }
  };

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await api.get<CustomerDropdownItem[]>(ENDPOINTS.PORTAL.CUSTOMERS_DROPDOWN);
      setCustomers(response.data);
    } catch (error) {
      showMessage('error', 'Failed to load customer list.');
    }
  }, []);

  const loadInwardData = async (inwardId: number) => {
    setIsLoadingData(true);
    try {
      const response = await api.get<InwardDetail>(`${ENDPOINTS.STAFF.INWARDS}/${inwardId}`);
      const inward = response.data;
      
      setFormData({
        srf_no: inward.srf_no.toString(),
        material_inward_date: safeDate(inward.material_inward_date),
        customer_dc_date: safeDate(inward.customer_dc_date),
        customer_dc_no: (inward as any).customer_dc_no ?? '',
        receiver: inward.receiver || '',
        customer_id: inward.customer_id,
        customer_details: inward.customer_details,
        status: inward.status
      });
      setSelectedCustomerId(inward.customer_id);
      
      if (inward.customer_id && customers.length > 0) {
         const found = customers.find(c => c.customer_id === inward.customer_id);
         if (found?.email) setSelectedCustomerEmail(found.email);
      }

      // Merge existing materials from this inward into options
      const usedMaterials = new Set((inward.equipments || []).map(eq => eq.material_description));
      setMaterialOptions(prev => {
         const combined = new Set([...prev, ...usedMaterials]);
         return Array.from(combined).filter(Boolean).sort();
      });

      const equipmentData: EquipmentDetail[] = (inward.equipments ?? []).map((eq) => {
        let rawCalibBy = eq.calibration_by || 'In Lab';
        if (rawCalibBy === 'Out Lab') rawCalibBy = 'On-Site';
        const calibrationBy = (['In Lab', 'Outsource', 'On-Site'] as const).includes(rawCalibBy as any)
          ? (rawCalibBy as 'In Lab' | 'Outsource' | 'On-Site')
          : 'In Lab';
        
        const visualNotes = eq.visual_inspection_notes || 'OK';
        const isOk = visualNotes.trim().toUpperCase() === 'OK';
        
        const existingPhotoUrls = Array.isArray(eq.photos)
          ? eq.photos.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
          : [];

        return {
          nepl_id: eq.nepl_id,
          material_desc: eq.material_description,
          make: eq.make,
          model: eq.model,
          range: eq.range || '',
          serial_no: eq.serial_no || '',
          qty: eq.quantity,
          calibration_by: calibrationBy,
          inspe_status: isOk ? 'OK' : 'Not OK',
          inspe_remarks: '', 
          engineer_remarks: (eq as any).engineer_remarks || eq.engineer_remarks || '', 
          accessories_included: (eq as any).accessories_included || '',
          remarks_and_decision: (eq as any).customer_remarks || null,
          photos: [],
          photoPreviews: [],
          existingPhotoUrls,
          supplier: (eq as any).supplier,
          in_dc: (eq as any).in_dc,
          out_dc: (eq as any).out_dc
        } as EquipmentDetail;
      });

      cleanupAllPreviews();
      setEquipmentList(equipmentData.length > 0 ? equipmentData : [{
        nepl_id: `${inward.srf_no}-1`,
        material_desc: '',
        make: '',
        model: '',
        qty: 1,
        calibration_by: 'In Lab' as const,
        inspe_status: 'OK' as const,
        inspe_remarks: '',
        engineer_remarks: '',
        accessories_included: '',
        photos: [],
        photoPreviews: [],
        existingPhotoUrls: []
      }]);
    } catch (error) {
      console.error('Error loading inward data:', error);
      showMessage('error', 'Failed to load inward data.');
      navigate('/engineer/view-inward');
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadDraftData = async (draftId: number) => {
    setIsLoadingData(true);
    try {
      const response = await api.get<DraftLoadResponse>(`${ENDPOINTS.STAFF.DRAFTS}/${draftId}`);
      const draftData = response.data.draft_data;
      const nextSrf = await fetchNextSrfNo();

      if (draftData) {
        const newFormData: ExtendedInwardFormType = {
          srf_no: nextSrf,
          material_inward_date: safeDate(draftData.material_inward_date),
          customer_dc_date: safeDate(draftData.customer_dc_date),
          customer_dc_no: draftData.customer_dc_no ?? '',
          customer_id: draftData.customer_id || null,
          customer_details: draftData.customer_details || '',
          receiver: draftData.receiver || '',
          status: 'created' as const
        };
        
        if (draftData.equipment_list) {
            const draftMaterials = new Set(draftData.equipment_list.map((eq: any) => eq.material_desc));
            setMaterialOptions(prev => {
                 const combined = new Set([...prev, ...draftMaterials]);
                 return Array.from(combined).filter(Boolean).sort();
            });
        }

        const newEquipmentList: EquipmentDetail[] = (draftData.equipment_list || []).map(eq => {
          const existingPhotoUrls = (() => {
            if (Array.isArray((eq as any).existingPhotoUrls)) return (eq as any).existingPhotoUrls;
            if (Array.isArray((eq as any).existing_photo_urls)) return (eq as any).existing_photo_urls;
            return [];
          })().filter((path: unknown): path is string => typeof path === 'string' && path.trim().length > 0);
          return {
            ...eq,
            photos: [],
            photoPreviews: [],
            existingPhotoUrls
          };
        });
        setFormData(newFormData);
        setSelectedCustomerId(newFormData.customer_id);
        
        if (newFormData.customer_id && customers.length > 0) {
            const foundCust = customers.find(c => c.customer_id === newFormData.customer_id);
            if (foundCust && foundCust.email) setSelectedCustomerEmail(foundCust.email);
        }

        cleanupAllPreviews();
        setEquipmentList(newEquipmentList);
        setCurrentDraftId(draftId);
        lastSavedDataRef.current = serializeDraftState({ formData: newFormData, equipmentList: newEquipmentList });
        setDraftSaveStatus('saved');
        setLastAutoSaveTime(new Date());
        showMessage('success', 'Draft loaded successfully! Auto-save is active.');
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      showMessage('error', 'Failed to load draft.');
      navigate('/engineer');
    } finally {
      setIsLoadingData(false);
    }
  };

  const initializeForm = async () => {
    setCurrentDraftId(null);
    setDraftSaveStatus('idle');
    setLastAutoSaveTime(null);
    cleanupAllPreviews();
    setEquipmentList([]);
    setSelectedCustomerId(null);
    setSelectedCustomerEmail('');
    
    try {
      const displaySrf = await fetchNextSrfNo();
      
      const newFormData: ExtendedInwardFormType = {
        srf_no: displaySrf,
        material_inward_date: safeDate(new Date().toISOString()),
        customer_dc_date: '',
        customer_dc_no: '',
        receiver: user?.full_name || user?.username || '',
        customer_id: null,
        customer_details: '',
        status: 'created' as const
      };
      
      const newEquipmentList: EquipmentDetail[] = [{
        nepl_id: `${displaySrf}-1`,
        material_desc: '',
        make: '',
        model: '',
        qty: 1,
        calibration_by: 'In Lab' as const,
        inspe_status: 'OK' as const,
        inspe_remarks: '',
        engineer_remarks: '',
        accessories_included: '',
        photos: [],
        photoPreviews: [],
        existingPhotoUrls: []
      }];
      
      setFormData(newFormData);
      setEquipmentList(newEquipmentList);
      lastSavedDataRef.current = serializeDraftState({
        formData: newFormData,
        equipmentList: newEquipmentList,
      });
    } catch (error: any) {
      setFormData(prev => ({ ...prev, srf_no: 'Error!' }));
    } finally {
      setIsLoadingData(false);
    }
  };

  // --- LIFECYCLE ---

  useEffect(() => {
    fetchCustomers();
    fetchMaterials(); // Load history on mount
    
    if (isEditMode && editId) {
      loadInwardData(parseInt(editId));
    } else if (initialDraftId) {
      loadDraftData(initialDraftId);
    } else {
      initializeForm();
    }

    const handleBeforeUnloadLocal = (e: BeforeUnloadEvent) => handleBeforeUnload(e);
    window.addEventListener('beforeunload', handleBeforeUnloadLocal);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnloadLocal);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      cleanupAllPreviews();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editId, initialDraftId, fetchCustomers, fetchMaterials]);

  useEffect(() => {
    if (!isEditMode && isFormReady && hasFormData) {
      const currentData = serializeDraftState();
      if (currentData !== lastSavedDataRef.current) {
        setDraftSaveStatus('unsaved');
        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = setTimeout(() => triggerAutoSave(), 2000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, equipmentList, isFormReady, hasFormData, isEditMode, serializeDraftState]);


  // --- LOGIC HANDLERS ---

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    const currentData = JSON.stringify({ formData, equipmentList });
    if (hasFormData && !isEditMode && currentData !== lastSavedDataRef.current) {
      const message = 'You have unsaved changes. Are you sure you want to leave?';
      e.returnValue = message;
      return message;
    }
  };

  const handleBackToPortal = () => {
    if (hasFormData && !isEditMode && JSON.stringify({ formData, equipmentList }) !== lastSavedDataRef.current) {
      if(!window.confirm('You have unsaved changes. Are you sure you want to go back?')) {
        return;
      }
    }
    if (isEditMode) {
      navigate('/engineer/view-inward');
    } else {
      navigate('/engineer/create-inward');
    }
  };

  const triggerAutoSave = async () => {
    if (!isFormReady || isEditMode) return;
    setDraftSaveStatus('saving');
    try {
      const equipmentDraftPayload = equipmentList.map(({ photos, photoPreviews, existingPhotoUrls, ...rest }) => {
        return {
          ...rest,
          qty: Number(rest.qty) || 1,
          existing_photo_urls: (existingPhotoUrls || []).filter((url): url is string => Boolean(url?.trim()))
        };
      });

      const draftPayload = {
        inward_id: currentDraftId,
        draft_data: {
          ...formData,
          srf_no: 'TBD', 
          equipment_list: equipmentDraftPayload
        }
      };
      const response = await api.patch<DraftSaveResponse>(ENDPOINTS.STAFF.DRAFT, draftPayload);

      if (response.data?.inward_id) {
        const newDraftId = response.data.inward_id;
        if (!currentDraftId) {
          setCurrentDraftId(newDraftId);
          navigate(`/engineer/create-inward?draft=${newDraftId}`, { replace: true });
        }
        setDraftSaveStatus('saved');
        setLastAutoSaveTime(new Date());
        lastSavedDataRef.current = serializeDraftState({ formData, equipmentList });
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      setDraftSaveStatus('error');
    }
  };

  const getDraftStatusIcon = () => {
    switch (draftSaveStatus) {
      case 'saving': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'saved': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'unsaved': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle2 className="h-4 w-4 text-gray-400" />;
    }
  };

  const getDraftStatusText = () => {
    switch (draftSaveStatus) {
      case 'saving': return 'Saving...';
      case 'saved': return lastAutoSaveTime ? `Saved at ${lastAutoSaveTime.toLocaleTimeString()}` : 'Draft saved';
      case 'error': return 'Save failed - retrying...';
      case 'unsaved': return 'Unsaved changes';
      default: return 'Auto-save active';
    }
  };

  // --- NEW MATERIAL LOGIC (DYNAMIC) ---

  const handleAddCustomMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialInput.trim()) return;
    
    const newItem = newMaterialInput.trim();
    
    // Update Local State immediately so it appears in dropdown for THIS form
    setMaterialOptions(prev => {
        // Use case-insensitive check to avoid duplicates
        if(prev.some(item => item.toLowerCase() === newItem.toLowerCase())) return prev;
        return [...prev, newItem].sort();
    });

    // Set the value for the specific row
    if (activeRowForNewMaterial !== null) {
        handleEquipmentChange(activeRowForNewMaterial, 'material_desc', newItem);
    }
    
    // 3. Reset UI
    setNewMaterialInput("");
    setShowAddMaterialModal(false);
    setActiveRowForNewMaterial(null);
    showMessage('success', 'Item added! Submit this form to save it permanently.');
  };

  // --- NEW CUSTOMER LOGIC ---

  const handleNewCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setNewCustomerData(prev => {
        const updated = { ...prev, [name]: checked };
        if (name === 'same_as_ship' && checked) {
          updated.bill_to_address = updated.ship_to_address;
        }
        return updated;
      });
    } else {
      setNewCustomerData(prev => {
        const updated = { ...prev, [name]: value };
        if (prev.same_as_ship && name === 'ship_to_address') {
          updated.bill_to_address = value;
        }
        return updated;
      });
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingCustomer(true);

    try {
      const payload = {
        email: newCustomerData.email,
        role: 'customer',
        invited_name: newCustomerData.contact_person,
        company_name: newCustomerData.company_name,
        ship_to_address: newCustomerData.ship_to_address,
        bill_to_address: newCustomerData.bill_to_address, 
        phone_number: newCustomerData.phone
      };

      await api.post('/invitations/send', payload);

      showMessage('success', 'Company registered and invitation sent successfully!');
      
      await fetchCustomers();
      setShowAddCustomerModal(false);
      
      setNewCustomerData({
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        ship_to_address: '',
        bill_to_address: '',
        same_as_ship: false
      });

      const updatedCustomersRes = await api.get<CustomerDropdownItem[]>(ENDPOINTS.PORTAL.CUSTOMERS_DROPDOWN);
      const newCust = updatedCustomersRes.data.find(c => c.email === payload.email);
      
      if (newCust) {
        setCustomers(updatedCustomersRes.data);
        setFormData(prev => ({
            ...prev,
            customer_id: newCust.customer_id,
            customer_details: newCust.customer_details
        }));
        setSelectedCustomerId(newCust.customer_id);
        setSelectedCustomerEmail(newCust.email || '');
      }

    } catch (error: any) {
      console.error("Failed to create customer", error);
      showMessage('error', error.response?.data?.detail || 'Failed to register company.');
    } finally {
      setIsCreatingCustomer(false);
    }
  };


  // --- FORM HANDLERS ---

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'customer_id') {
      if (value === 'new') {
        setShowAddCustomerModal(true);
        return; 
      }

      const customerId = parseInt(value);
      const selectedCustomer = customers.find(c => c.customer_id === customerId);
      
      setFormData(prev => ({
        ...prev,
        customer_id: customerId,
        customer_details: selectedCustomer ? selectedCustomer.customer_details : ''
      }));
      setSelectedCustomerId(customerId);
      setSelectedCustomerEmail(selectedCustomer?.email || '');
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEquipmentChange = (index: number, field: keyof EquipmentDetail, value: string | number) => {
    setEquipmentList(currentList => {
      const updatedList = [...currentList];
      const equipmentToUpdate = { ...updatedList[index] };
      
      if (field === 'inspe_status') {
          equipmentToUpdate.inspe_status = value as 'OK' | 'Not OK';
          // If OK, clear engineer remarks
          if (value === 'OK') {
             equipmentToUpdate.engineer_remarks = ''; 
          }
      } else if (field === 'calibration_by') {
          (equipmentToUpdate as any).calibration_by = value as 'In Lab' | 'Outsource' | 'On-Site';
          if (value !== 'Outsource') {
            delete (equipmentToUpdate as any).supplier;
            delete (equipmentToUpdate as any).in_dc;
            delete (equipmentToUpdate as any).out_dc;
          }
      } else {
        (equipmentToUpdate as any)[field] = value;
      }
      updatedList[index] = equipmentToUpdate;
      return updatedList;
    });
  };

  const addEquipmentRow = () => {
    setEquipmentList(currentList => {
      const newIndex = currentList.length + 1;
      const neplId = `${formData.srf_no}-${newIndex}`;
      return [...currentList, {
        nepl_id: neplId,
        material_desc: '',
        make: '',
        model: '',
        qty: 1,
        calibration_by: 'In Lab' as const,
        inspe_status: 'OK' as const,
        inspe_remarks: '',
        engineer_remarks: '',
        accessories_included: '',
        photos: [],
        photoPreviews: [],
        existingPhotoUrls: []
      }];
    });
  };

  const removeEquipmentRow = (indexToRemove: number) => {
    if (!window.confirm('Are you sure you want to delete this equipment row? This action cannot be undone.')) {
      return;
    }

    const equipmentToRemove = equipmentList[indexToRemove];
    if (equipmentToRemove?.photoPreviews?.length) {
        equipmentToRemove.photoPreviews.forEach(url => {
            URL.revokeObjectURL(url);
            previewUrlsRef.current = previewUrlsRef.current.filter(existing => existing !== url);
        });
    }

    const updatedList = equipmentList
        .filter((_, i) => i !== indexToRemove)
        .map((item, i) => ({
            ...item,
            nepl_id: `${formData.srf_no}-${i + 1}`
        }));

    if (updatedList.length === 0) {
        addEquipmentRow();
    } else {
        setEquipmentList(updatedList);
    }
  };

  const handlePhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    newPreviews.forEach(url => previewUrlsRef.current.push(url));

    setEquipmentList(currentList => {
      const updatedList = [...currentList];
      if (!updatedList[index]) return currentList;
      const currentEquipment = { ...updatedList[index] };
      currentEquipment.photos = [...(currentEquipment.photos || []), ...newFiles];
      currentEquipment.photoPreviews = [...(currentEquipment.photoPreviews || []), ...newPreviews];
      updatedList[index] = currentEquipment;
      return updatedList;
    });

    e.target.value = '';
  };

  const handleRemovePhoto = (eqIndex: number, photoIndex: number) => {
    let previewToRemove: string | undefined;
    setEquipmentList(currentList => {
      const updatedList = [...currentList];
      const equipment = updatedList[eqIndex];
      if (!equipment) return currentList;
      const nextPhotos = (equipment.photos || []).filter((_, pIndex) => pIndex !== photoIndex);
      const currentPreviews = equipment.photoPreviews || [];
      previewToRemove = currentPreviews[photoIndex];
      const nextPreviews = currentPreviews.filter((_, pIndex) => pIndex !== photoIndex);
      updatedList[eqIndex] = { ...equipment, photos: nextPhotos, photoPreviews: nextPreviews };
      return updatedList;
    });

    if (previewToRemove) {
      URL.revokeObjectURL(previewToRemove);
      previewUrlsRef.current = previewUrlsRef.current.filter(url => url !== previewToRemove);
    }
  };

  const viewEquipmentDetails = (index: number) => setSelectedEquipment(equipmentList[index]);

  // --- PDF GENERATION (PROFESSIONAL A4 SIZE) ---

  const generatePDF = (isForDownload: boolean, srfOverride?: string) => {
    // 1. Explicitly set format to A4 Landscape to fit all columns
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    const displaySrfNo = srfOverride || formData.srf_no;
    const primaryColor = [44, 62, 80] as [number, number, number]; // Dark Blue
    const accentColor = [240, 240, 240] as [number, number, number]; // Light Gray
    
    let cursorY = 15;

    // --- HEADER SECTION ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.text("NextAge Engineering Private Limited", pageWidth / 2, cursorY, { align: 'center' });
    
    cursorY += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("Plot No. 39, KIADB Industrial Area, Hoskote, Bangalore - 562114", pageWidth / 2, cursorY, { align: 'center' });
    
    cursorY += 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("MATERIAL INWARD RECEIPT", pageWidth / 2, cursorY, { align: 'center' });
    
    cursorY += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(10, cursorY, pageWidth - 10, cursorY);
    
    // --- INFO BOXES ---
    cursorY += 5;
    const boxWidth = (pageWidth - 25) / 2;
    const boxHeight = 30;
    
    doc.setFillColor(...accentColor);
    doc.roundedRect(10, cursorY, boxWidth, boxHeight, 2, 2, 'F');
    
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text("Inward Details", 15, cursorY + 6);
    
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`SRF No:`, 15, cursorY + 13);
    doc.setFont("helvetica", "bold");
    doc.text(`${displaySrfNo} ${srfOverride ? "" : "(Prov.)"}`, 45, cursorY + 13);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Date:`, 15, cursorY + 19);
    doc.text(`${formData.material_inward_date}`, 45, cursorY + 19);

    doc.text(`Received By:`, 15, cursorY + 25);
    doc.text(`${formData.receiver}`, 45, cursorY + 25);

    // Box 2: Customer Details
    doc.setFillColor(...accentColor);
    doc.roundedRect(15 + boxWidth, cursorY, boxWidth, boxHeight, 2, 2, 'F');
    
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("Customer Details", 20 + boxWidth, cursorY + 6);
    
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    
    doc.setFont("helvetica", "bold");
    const custName = doc.splitTextToSize(formData.customer_details.split(',')[0], boxWidth - 10);
    doc.text(custName, 20 + boxWidth, cursorY + 13);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Customer DC:`, 20 + boxWidth, cursorY + 22);
    doc.setFont("helvetica", "bold");
    doc.text(`${formData.customer_dc_no}`, 50 + boxWidth, cursorY + 22);
    
    doc.setFont("helvetica", "normal");
    doc.text(`DC Date:`, 90 + boxWidth, cursorY + 22);
    doc.text(`${formData.customer_dc_date || '-'}`, 110 + boxWidth, cursorY + 22);

    cursorY += boxHeight + 8;

    // --- DETAILED TABLE ---
    
    const tableColumn = [
      "#", "NEPL ID", "Description", "Make", "Model", "Serial No", "Range", "Qty", 
      "Cal Type", "Accessories", "Visual"
    ];

    // Dynamically add Remarks column to PDF only if needed
    if (showEngineerRemarksColumn) {
        tableColumn.push("Eng. Remarks");
    }
    
    const hasOutsource = equipmentList.some(eq => eq.calibration_by === 'Outsource');
    if(hasOutsource) tableColumn.push("Supplier / DC");

    const tableRows: any[] = [];

    equipmentList.forEach((eq, index) => {
      const rowData = [
        index + 1,
        eq.nepl_id || `${displaySrfNo}-${index+1}`,
        eq.material_desc,
        eq.make,
        eq.model,
        eq.serial_no || '-',
        eq.range || '-',
        eq.qty,
        eq.calibration_by,
        eq.accessories_included || '-',
        eq.inspe_status, // Column 11: Visual Status
      ];
      
      // Add remarks data if column exists
      if (showEngineerRemarksColumn) {
        rowData.push(eq.engineer_remarks || '-');
      }
      
      if(hasOutsource) {
          if(eq.calibration_by === 'Outsource') {
             rowData.push(`${(eq as any).supplier || ''}\n${(eq as any).out_dc || ''}`);
          } else {
             rowData.push('-');
          }
      }
      
      tableRows.push(rowData);
    });

    autoTable(doc, {
      startY: cursorY,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { 
          fillColor: primaryColor, 
          textColor: 255, 
          fontSize: 8, 
          fontStyle: 'bold',
          halign: 'center'
      },
      styles: { 
          fontSize: 8, 
          cellPadding: 2, 
          overflow: 'linebreak',
          valign: 'middle',
          lineColor: [200, 200, 200],
          lineWidth: 0.1
      },
      // Adjusted column widths to fit A4 Landscape
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },  // #
        1: { cellWidth: 20 }, // NEPL ID
        2: { cellWidth: 35 }, // Desc
        3: { cellWidth: 18 }, // Make
        4: { cellWidth: 18 }, // Model
        5: { cellWidth: 18 }, // Serial
        6: { cellWidth: 15 }, // Range
        7: { cellWidth: 10, halign: 'center' }, // Qty
        8: { cellWidth: 18 }, // Cal Type
        9: { cellWidth: 25 }, // Accessories
        10: { cellWidth: 15, halign: 'center' }, // Visual
        // If Remarks column is present, give it width, otherwise ignore
        ...(showEngineerRemarksColumn ? { 11: { cellWidth: 35 } } : {})
      }
    });

    // --- FOOTER & SIGNATURES ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    if (finalY > pageHeight - 40) {
        doc.addPage();
        cursorY = 20;
    } else {
        cursorY = finalY;
    }

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("Note: This is a computer generated receipt. Discrepancies must be reported within 24 hours.", 10, cursorY);
    
    cursorY += 15;
    
    doc.setDrawColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    doc.text("Received By:", 20, cursorY);
    doc.text(formData.receiver, 20, cursorY + 15);
    doc.line(20, cursorY + 16, 70, cursorY + 16);
    
    doc.text("Authorized Signatory:", pageWidth - 70, cursorY);
    doc.line(pageWidth - 70, cursorY + 16, pageWidth - 20, cursorY + 16); 
    doc.text("NextAge Engineering Pvt Ltd", pageWidth - 70, cursorY + 20);

    const pageCount = (doc as any).internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }

    if (isForDownload) {
      doc.save(`Inward_Receipt_${displaySrfNo}.pdf`);
    }
  };

  // --- PREVIEW & SUBMIT FLOW ---

  const handlePreviewClick = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.receiver || formData.customer_id === null) {
        showMessage('error', 'Please fill in Receiver and select a Company.');
        return;
    }
    if (equipmentList.some(eq => !eq.material_desc || !eq.make || !eq.model)) {
        showMessage('error', 'Fill in Material Desc, Make, and Model for all equipment.');
        return;
    }

    setShowPreviewModal(true);
  };

  const handleFinalSubmit = async () => {
    setShowPreviewModal(false);
    setIsLoading(true);
    
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    try {
      const submissionData = new FormData();
      const finalInwardDate = formData.material_inward_date || new Date().toISOString().split('T')[0];

      // 1. Basic Fields
      submissionData.append('srf_no', formData.srf_no); 
      submissionData.append('material_inward_date', finalInwardDate);
      submissionData.append('customer_dc_date', formData.customer_dc_date || "");
      submissionData.append('customer_dc_no', formData.customer_dc_no);
      submissionData.append('receiver', formData.receiver);
      
      if (!formData.customer_id) throw new Error("Customer ID is missing");
      submissionData.append('customer_id', formData.customer_id.toString());
      
      submissionData.append('customer_details', formData.customer_details);

      // 2. Equipment List
      const equipmentDataForJson = equipmentList.map((item) => {
        const isOutsource = item.calibration_by === 'Outsource';
        
        return {
          nepl_id: item.nepl_id,
          material_desc: item.material_desc, 
          make: item.make,
          model: item.model,
          range: item.range || "",
          serial_no: item.serial_no || "",
          qty: Number(item.qty), 
          calibration_by: item.calibration_by,
          // Just send "OK" or "Not OK" based on status
          visual_inspection_notes: item.inspe_status,
          engineer_remarks: item.engineer_remarks || "", // Include Engineer Remarks
          accessories_included: item.accessories_included || "",
          supplier: isOutsource ? ((item as any).supplier || "") : null, 
          in_dc: isOutsource ? ((item as any).in_dc || "") : null,
          out_dc: isOutsource ? ((item as any).out_dc || "") : null,
          existing_photo_urls: (item.existingPhotoUrls || []).filter((url): url is string => Boolean(url?.trim()))
        };
      });

      submissionData.append('equipment_list', JSON.stringify(equipmentDataForJson));

      // 3. Photos
      equipmentList.forEach((equipment, index) => {
        equipment.photos?.forEach((photoFile: File) => {
            submissionData.append(`photos_${index}`, photoFile, photoFile.name)
        });
      });

      let response;
      if (isEditMode && editId) {
        response = await api.put<InwardResponse>(`${ENDPOINTS.STAFF.INWARDS}/${editId}`, submissionData, { headers: { 'Content-Type': 'multipart/form-data' } });
        showMessage('success', 'Inward updated successfully!');
        navigate('/engineer/view-inward');
      } else {
        if (currentDraftId) submissionData.append('inward_id', currentDraftId.toString());
        
        response = await api.post<InwardResponse>(ENDPOINTS.STAFF.SUBMIT, submissionData, { headers: { 'Content-Type': 'multipart/form-data' } });
        
        const realSrfNo = String(response.data.srf_no);
        
        showMessage('success', `Inward Submitted! SRF Assigned: ${realSrfNo}`);
        
        setLastSavedInwardId(response.data.inward_id);
        setLastSavedSrfNo(realSrfNo);
        setReportEmails([selectedCustomerEmail || '']);
        setFormData(prev => ({ ...prev, srf_no: realSrfNo })); 

        setTimeout(() => {
            try {
                generatePDF(true, realSrfNo);
            } catch (err) {
                console.error("PDF Generation failed", err);
            }
        }, 500);
        
        setShowEmailModal(true);
      }
    } catch (error: any) {
        console.error("Submission Error", error);
        
        let errorMsg = 'Submission failed';
        if (error.response?.status === 422 && Array.isArray(error.response.data.detail)) {
            console.log("Validation Details:", error.response.data.detail);
            errorMsg = `Validation Error: ${error.response.data.detail.map((d: any) => `${d.loc[d.loc.length-1]}: ${d.msg}`).join(' | ')}`;
        } else if (error.response?.data?.detail) {
            errorMsg = typeof error.response.data.detail === 'string' ? error.response.data.detail : JSON.stringify(error.response.data.detail);
        } else if (error.message) {
            errorMsg = error.message;
        }
        
        showMessage('error', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // --- EMAIL HANDLERS ---

  const addEmailField = () => {
    setReportEmails(prev => [...prev, '']);
  };

  const removeEmailField = (index: number) => {
    setReportEmails(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendFir = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEmails = reportEmails.filter(email => email.trim() && email.includes('@'));
    if (validEmails.length === 0 || !lastSavedInwardId) return;
    try {
      await api.post(`${ENDPOINTS.STAFF.INWARDS}/${lastSavedInwardId}/send-report`, { 
        emails: validEmails, send_later: false 
      });
      showMessage('success', `FIR sent successfully!`);
      navigate('/engineer/create-inward', { replace: true });
    } catch (error: any) {
      showMessage('error', 'Failed to send FIR.');
    }
  };

  const handleScheduleFir = async () => {
    if (!lastSavedInwardId) return;
    try {
      await api.post(`${ENDPOINTS.STAFF.INWARDS}/${lastSavedInwardId}/send-report`, { send_later: true });
      showMessage('success', `FIR Scheduled.`);
      navigate('/engineer/create-inward', { replace: true });
    } catch (error: any) {
      showMessage('error', 'Failed to schedule FIR.');
    }
  };

  // --- RENDER FUNCTIONS ---

  const renderAddMaterialModal = () => {
    if (!showAddMaterialModal) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-y-auto relative">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-blue-50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <PackagePlus className="text-blue-600" size={20} />
              <h2 className="text-lg font-bold text-gray-800">Add New Material</h2>
            </div>
            <button 
              onClick={() => setShowAddMaterialModal(false)} 
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleAddCustomMaterial} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Material Name</label>
              <input 
                type="text"
                autoFocus
                value={newMaterialInput}
                onChange={(e) => setNewMaterialInput(e.target.value)}
                placeholder="e.g. Digital Multimeter"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none" 
              />
              <p className="text-xs text-gray-500 mt-2">This will be added to the history list after you submit the form.</p>
            </div>
            <div className="flex gap-2 pt-2">
               <button 
                 type="button"
                 onClick={() => setShowAddMaterialModal(false)}
                 className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
               >
                 Cancel
               </button>
               <button 
                 type="submit" 
                 disabled={!newMaterialInput.trim()}
                 className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-blue-300"
               >
                 Add Item
               </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderAddCustomerModal = () => {
    if (!showAddCustomerModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-50 rounded-t-xl">
            <div className="flex items-center gap-3">
              <UserPlus className="text-blue-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800">Register New Company</h2>
            </div>
            <button 
              onClick={() => setShowAddCustomerModal(false)} 
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={handleCreateCustomer} className="p-6 space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Company Name *</label>
                <input 
                  name="company_name" 
                  required 
                  value={newCustomerData.company_name} 
                  onChange={handleNewCustomerChange}
                  placeholder="e.g., ACME Industries Pvt Ltd"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none" 
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Person *</label>
                  <input 
                    name="contact_person" 
                    required 
                    value={newCustomerData.contact_person} 
                    onChange={handleNewCustomerChange}
                    placeholder="Full Name"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number *</label>
                  <input 
                    name="phone" 
                    required 
                    value={newCustomerData.phone} 
                    onChange={handleNewCustomerChange}
                    placeholder="Mobile/Landline"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email (for Invitation) *</label>
                <input 
                  type="email"
                  name="email" 
                  required 
                  value={newCustomerData.email} 
                  onChange={handleNewCustomerChange}
                  placeholder="admin@company.com"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none" 
                />
                <p className="text-xs text-gray-500 mt-1">An invitation to access the portal will be sent here.</p>
              </div>

              <div className="pt-2 border-t">
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <MapPin size={16} className="text-gray-500"/> Ship To Address *
                </label>
                <textarea 
                  name="ship_to_address" 
                  required 
                  value={newCustomerData.ship_to_address} 
                  onChange={handleNewCustomerChange}
                  rows={2}
                  placeholder="Shipping location..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none resize-none" 
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-gray-700">Bill To Address *</label>
                  <label className="flex items-center space-x-2 text-sm text-blue-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="same_as_ship" 
                      checked={newCustomerData.same_as_ship}
                      onChange={handleNewCustomerChange}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Same as Ship To</span>
                  </label>
                </div>
                <textarea 
                  name="bill_to_address" 
                  required 
                  value={newCustomerData.bill_to_address} 
                  onChange={handleNewCustomerChange}
                  disabled={newCustomerData.same_as_ship}
                  rows={2}
                  placeholder="Billing location..."
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none resize-none ${newCustomerData.same_as_ship ? 'bg-gray-100 text-gray-500' : ''}`} 
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
               <button 
                 type="button"
                 onClick={() => setShowAddCustomerModal(false)}
                 className="flex-1 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
               >
                 Cancel
               </button>
               <button 
                 type="submit" 
                 disabled={isCreatingCustomer}
                 className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-blue-400 flex justify-center items-center gap-2"
               >
                 {isCreatingCustomer ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
                 <span>Register & Invite</span>
               </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderPreviewModal = () => {
    if (!showPreviewModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4 overflow-y-auto">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl my-8 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b bg-gray-50 rounded-t-lg">
            <div className="flex items-center gap-3">
              <FileText className="text-blue-600" size={28} />
              <h2 className="text-2xl font-bold text-gray-800">Inward Receipt Preview</h2>
            </div>
            <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-red-500">
              <X size={28} />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 overflow-y-auto bg-gray-50">
            <div className="bg-white p-8 shadow-sm border border-gray-200 mx-auto max-w-[210mm] min-h-[297mm]">
              <div className="text-center border-b pb-4 mb-6">
                <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-wider">NextAge Engineering Pvt Ltd</h1>
                <p className="text-gray-600 text-sm mt-1">Material Inward Receipt</p>
              </div>

              <div className="flex justify-between text-sm mb-8 gap-8">
                <div className="w-1/2 space-y-2">
                  <div className="flex"><span className="font-semibold w-32">Inward Date:</span> <span>{formData.material_inward_date}</span></div>
                  <div className="flex"><span className="font-semibold w-32">SRF No:</span> <span className="text-blue-600 font-bold">{formData.srf_no} (Provisional)</span></div>
                  <div className="flex"><span className="font-semibold w-32">Received By:</span> <span>{formData.receiver}</span></div>
                </div>
                <div className="w-1/2 space-y-2">
                   <div className="flex"><span className="font-semibold w-32">Customer DC:</span> <span>{formData.customer_dc_no}</span></div>
                   <div className="flex"><span className="font-semibold w-32">DC Date:</span> <span>{formData.customer_dc_date || '-'}</span></div>
                </div>
              </div>

              <div className="mb-8 p-4 bg-gray-50 rounded border border-gray-100">
                <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase">Customer Details</h3>
                <p className="text-gray-800 whitespace-pre-line text-sm">{formData.customer_details}</p>
              </div>

              <table className="w-full text-sm border-collapse border border-gray-300 mb-8">
                <thead>
                  <tr className="bg-blue-50 text-blue-900">
                    <th className="border border-gray-300 p-2 w-12 text-center">#</th>
                    <th className="border border-gray-300 p-2 text-left">Description</th>
                    <th className="border border-gray-300 p-2 text-left">Make / Model</th>
                    <th className="border border-gray-300 p-2 text-left">Serial No</th>
                    <th className="border border-gray-300 p-2 text-center w-16">Qty</th>
                    <th className="border border-gray-300 p-2 text-left">Accessories</th>
                    <th className="border border-gray-300 p-2 text-left">Visual</th>
                    {showEngineerRemarksColumn && <th className="border border-gray-300 p-2 text-left">Eng. Remarks</th>}
                  </tr>
                </thead>
                <tbody>
                  {equipmentList.map((eq, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 text-center">{idx + 1}</td>
                      <td className="border border-gray-300 p-2">{eq.material_desc}</td>
                      <td className="border border-gray-300 p-2">{eq.make} / {eq.model}</td>
                      <td className="border border-gray-300 p-2">{eq.serial_no || '-'}</td>
                      <td className="border border-gray-300 p-2 text-center">{eq.qty}</td>
                      <td className="border border-gray-300 p-2 text-gray-600 italic">
                        {eq.accessories_included || '-'}
                      </td>
                      <td className="border border-gray-300 p-2">
                         <span className={eq.inspe_status === 'Not OK' ? 'text-red-600 font-bold' : 'text-green-600'}>
                            {eq.inspe_status}
                         </span>
                      </td>
                      {showEngineerRemarksColumn && (
                        <td className="border border-gray-300 p-2 text-gray-600 text-xs">
                           {eq.engineer_remarks || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="mt-12 pt-4 border-t border-gray-300 flex justify-between items-end">
                 <div className="text-xs text-gray-400">Generated via NEPL Portal</div>
                 <div className="text-center">
                    <div className="h-12"></div>
                    <p className="text-sm font-semibold border-t border-gray-400 px-8 pt-1">Authorized Signature</p>
                 </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t bg-gray-50 flex justify-end gap-4 rounded-b-lg">
            <button 
              onClick={() => setShowPreviewModal(false)} 
              className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
            >
              Cancel / Edit
            </button>
            <button 
              onClick={handleFinalSubmit} 
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md"
            >
              <Download size={20} />
              <span>Submit & Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEmailModal = () => !showEmailModal ? null : (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 p-8 relative">
        <button onClick={() => navigate('/engineer/create-inward', { replace: true })} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">
          <X size={24} />
        </button>
        <div className="flex items-center space-x-4 mb-4">
          <Send className="text-green-600" size={36} />
          <h2 className="text-2xl font-bold text-gray-800">Submission Successful!</h2>
        </div>
        <p className="text-gray-600 mb-6">
          Inward SRF <strong>{lastSavedSrfNo}</strong> has been created.
          <br/>The PDF receipt has been downloaded. You can now email the FIR to the customer.
        </p>
        <div className="space-y-6">
          <form onSubmit={handleSendFir} className="p-4 border rounded-lg bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">Send FIR Immediately</label>
            <div className="space-y-2">
              {reportEmails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                        const newEmails = [...reportEmails];
                        newEmails[index] = e.target.value;
                        setReportEmails(newEmails);
                    }}
                    required
                    placeholder="Customer email..."
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  {reportEmails.length > 1 && (
                    <button type="button" onClick={() => removeEmailField(index)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"><X size={16} /></button>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" onClick={addEmailField} className="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg">+ Add Email</button>
                <button type="submit" className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-bold"><Send size={18} /><span>Send FIR</span></button>
              </div>
            </div>
          </form>
          <div className="p-4 border rounded-lg bg-gray-50">
            <button type="button" onClick={handleScheduleFir} className="w-full flex items-center justify-center space-x-2 px-6 py-3 text-orange-700 bg-orange-100 border border-orange-300 rounded-lg hover:bg-orange-200 font-medium">
              <Clock size={20} /><span>Schedule for Later</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const getModalEquipment = (): BaseEquipmentDetail | null => {
    if (!selectedEquipment) return null;

    const { inspe_status, inspe_remarks, accessories_included, ...rest } = selectedEquipment;

    const modalEquipment: BaseEquipmentDetail = {
      ...rest,
      calibration_by: selectedEquipment.calibration_by === 'On-Site' ? 'Out Lab' : selectedEquipment.calibration_by,
      inspe_notes: inspe_status === 'OK' ? 'OK' : (inspe_status === 'Not OK' ? 'Not OK' : inspe_remarks),
    };
    return modalEquipment;
  }

  if (isLoadingData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <span className="ml-4 text-xl text-gray-700">Loading Form...</span>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between border-b pb-4 mb-6 gap-4">
        <div className="flex items-center space-x-4">
          <FileText className="h-8 w-8 text-blue-600" />
          <div><h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit Inward Form' : 'New Inward Form'}</h1></div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
           {!isEditMode && (
            <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg border border-gray-200">
              {getDraftStatusIcon()} <span className="font-medium">{getDraftStatusText()}</span>
            </div>
           )}
          <button onClick={handleBackToPortal} className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm">
            <ArrowLeft size={18} /> <span>Back</span>
          </button>
        </div>
      </div>

      {!isEditMode && hasFormData && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <Save className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-900">Auto-Save Active</h3>
              <p className="text-sm text-blue-700">Your work is automatically saved. Feel free to resume anytime from the drafts section.</p>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`my-4 px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handlePreviewClick}>
        {/* Basic Info Block */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-gray-50 rounded-lg border">
             {/* SRF No Display */}
             <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">SRF No </label>
                <div className="flex items-center px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 font-bold">
                    {formData.srf_no}
                </div>
             </div>
             
             {/* Other Fields */}
             <div><label className="block text-sm font-semibold text-gray-700 mb-2">Material Inward Date *</label><input type="date" name="material_inward_date" value={formData.material_inward_date} onChange={handleFormChange} required className="w-full px-4 py-2 border rounded-lg" /></div>
             <div><label className="block text-sm font-semibold text-gray-700 mb-2">Customer DC No. *</label><input type="text" name="customer_dc_no" value={formData.customer_dc_no} onChange={handleFormChange} required placeholder="Enter Customer DC Number" className="w-full px-4 py-2 border rounded-lg" /></div>
             <div><label className="block text-sm font-semibold text-gray-700 mb-2">Customer DC Date</label><input type="date" name="customer_dc_date" value={formData.customer_dc_date} onChange={handleFormChange} className="w-full px-4 py-2 border rounded-lg" /></div>
             <div><label className="block text-sm font-semibold text-gray-700 mb-2">Receiver *</label><input type="text" name="receiver" value={formData.receiver} onChange={handleFormChange} required placeholder="Enter receiver username" className="w-full px-4 py-2 border rounded-lg" /></div>
             
             <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name & Address *</label>
              <select name="customer_id" value={selectedCustomerId || ''} onChange={handleFormChange} required className="w-full px-4 py-2 border rounded-lg bg-white" disabled={isEditMode}>
                <option value="">Select Company</option>
                {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.customer_details}</option>)}
                <option value="new" className="font-bold text-blue-600 bg-blue-50">+ Add New Company</option>
              </select>
            </div>

            {/* Display Addresses when a customer is selected */}
            {selectedCustomerData && (
              <>
                <div className="md:col-span-2 lg:col-span-1.5">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <MapPin size={16} className="text-gray-500" /> Ship To Address
                    </label>
                    <div className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 text-sm min-h-[80px] whitespace-pre-wrap">
                        {selectedCustomerData.ship_to_address || 'N/A'}
                    </div>
                </div>
                <div className="md:col-span-2 lg:col-span-1.5">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Receipt size={16} className="text-gray-500" /> Bill To Address
                    </label>
                    <div className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 text-sm min-h-[80px] whitespace-pre-wrap">
                        {selectedCustomerData.bill_to_address || 'N/A'}
                    </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Equipment Table */}
        <div className="mb-6">
           <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2"><Wrench size={24} className="text-blue-600" />Equipment Details</h2>
           </div>
           <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
              <table className="w-full text-sm border-collapse min-w-[2500px]">
                <thead className="bg-slate-100">
                    <tr>
                        <th className="sticky left-0 z-20 p-3 text-center text-xs font-semibold text-slate-600 uppercase bg-slate-100 border-b border-slate-200">#</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[160px]">NEPL ID</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[280px]">Material Description *</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[200px]">Make *</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[200px]">Model *</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[150px]">Range</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[150px]">Serial No</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[100px]">Qty *</th>
                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[150px]">Calibration *</th>
                        {isAnyOutsourced && (
                          <>
                            <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[200px]">Supplier</th>
                            <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[150px]">In DC</th>
                            <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[150px]">Out DC</th>
                          </>
                        )}
                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[200px]">Accessories Included</th>
                        
                        {/* SEPARATED COLUMNS */}
                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[150px]">Visual Inspection</th>
                        
                        {/* CONDITIONALLY RENDER ENGINEER REMARKS COLUMN HEADER */}
                        {showEngineerRemarksColumn && (
                             <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[250px]">Engineer Remarks</th>
                        )}

                        <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[250px]">Photos</th>
                        <th className="sticky right-0 z-20 p-3 text-center text-xs font-semibold text-slate-600 uppercase bg-slate-100 border-b border-slate-200">Actions</th>
                    </tr>
                </thead>
                <tbody>
                  {equipmentList.map((equipment, index) => (
                    <React.Fragment key={index}>
                      <tr className={`hover:bg-slate-50 group ${equipment.inspe_status === 'Not OK' ? 'bg-orange-50' : ''}`}>
                        <td className="sticky left-0 z-10 p-3 text-center font-semibold text-slate-500 bg-white group-hover:bg-slate-50">{index + 1}</td>
                        <td className="p-2"><input type="text" value={equipment.nepl_id} disabled className="w-full bg-slate-100 font-medium px-2 py-1.5 border border-slate-200 rounded-md" /></td>
                        <td className="p-2">
                            <select 
                              value={equipment.material_desc} 
                              onChange={(e) => {
                                if (e.target.value === 'ADD_NEW_CUSTOM') {
                                    setActiveRowForNewMaterial(index);
                                    setShowAddMaterialModal(true);
                                } else {
                                    handleEquipmentChange(index, 'material_desc', e.target.value);
                                }
                              }} 
                              required 
                              className="w-full px-4 py-2.5 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg"
                            >
                                <option value="">Select...</option>
                                {materialOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                <option value="ADD_NEW_CUSTOM" className="font-bold text-blue-600 bg-blue-50">+ Add New Item</option>
                            </select>
                        </td>
                        <td className="p-2"><input value={equipment.make} onChange={e=>handleEquipmentChange(index,'make',e.target.value)} required className="w-full px-2 py-1.5 border rounded-md" /></td>
                        <td className="p-2"><input value={equipment.model} onChange={e=>handleEquipmentChange(index,'model',e.target.value)} required className="w-full px-2 py-1.5 border rounded-md" /></td>
                        <td className="p-2"><input value={equipment.range} onChange={e=>handleEquipmentChange(index,'range',e.target.value)} className="w-full px-2 py-1.5 border rounded-md" /></td>
                        <td className="p-2"><input value={equipment.serial_no} onChange={e=>handleEquipmentChange(index,'serial_no',e.target.value)} className="w-full px-2 py-1.5 border rounded-md" /></td>
                        <td className="p-2"><input type="number" value={equipment.qty} min={1} onChange={e=>handleEquipmentChange(index,'qty',e.target.value)} required className="w-full px-2 py-1.5 border rounded-md text-center" /></td>
                        <td className="p-2">
                           <select value={equipment.calibration_by} onChange={e=>handleEquipmentChange(index,'calibration_by',e.target.value)} className="w-full px-2 py-1.5 border rounded-md">
                             <option value="In Lab">In Lab</option>
                             <option value="Outsource">Outsource</option>
                             <option value="On-Site">On-Site</option>
                           </select>
                        </td>
                        {equipment.calibration_by === 'Outsource' ? (
                          <>
                            <td className="p-2"><input placeholder="Supplier" value={(equipment as any).supplier || ''} onChange={(e) => handleEquipmentChange(index, 'supplier' as any, e.target.value)} className="w-full px-2 py-1.5 border rounded-md" /></td>
                            <td className="p-2"><input placeholder="In DC" value={(equipment as any).in_dc || ''} onChange={(e) => handleEquipmentChange(index, 'in_dc' as any, e.target.value)} className="w-full px-2 py-1.5 border rounded-md" /></td>
                            <td className="p-2"><input placeholder="Out DC" value={(equipment as any).out_dc || ''} onChange={(e) => handleEquipmentChange(index, 'out_dc' as any, e.target.value)} className="w-full px-2 py-1.5 border rounded-md" /></td>
                          </>
                        ) : ( isAnyOutsourced && <td colSpan={3} className="p-2 bg-slate-50"></td> )}
                        
                        <td className="p-2"><input value={equipment.accessories_included} onChange={e=>handleEquipmentChange(index,'accessories_included',e.target.value)} className="w-full px-2 py-1.5 border rounded-md" placeholder="e.g. Carry Case" /></td>
                        
                        {/* VISUAL INSPECTION COLUMN */}
                        <td className="p-2 align-top">
                             <select value={equipment.inspe_status} onChange={e=>handleEquipmentChange(index,'inspe_status',e.target.value)} className={`w-full px-2 py-1.5 border rounded-md ${equipment.inspe_status === 'Not OK' ? 'bg-red-50 border-red-300' : ''}`}>
                                 <option value="OK">OK</option>
                                 <option value="Not OK">Not OK</option>
                             </select>
                        </td>

                        {/* CONDITIONALLY RENDER ENGINEER REMARKS CELL */}
                        {showEngineerRemarksColumn && (
                            <td className="p-2 align-top">
                                {equipment.inspe_status === 'Not OK' ? (
                                     <textarea 
                                        placeholder="Describe the issue..." 
                                        value={equipment.engineer_remarks || ''} 
                                        onChange={e => handleEquipmentChange(index, 'engineer_remarks', e.target.value)} 
                                        rows={2}
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs bg-yellow-50 focus:ring-2 focus:ring-yellow-200" 
                                     />
                                ) : (
                                    <div className="flex justify-center items-center h-full pt-2">
                                        <span className="text-gray-300 text-lg">-</span>
                                    </div>
                                )}
                            </td>
                        )}

                        <td className="p-2">
                           <div className="flex items-center gap-2">
                              <label htmlFor={`photo-${index}`} className="cursor-pointer bg-gray-200 px-2 py-1 rounded text-xs flex items-center gap-1"><Camera size={12}/> Attach</label>
                              <input id={`photo-${index}`} type="file" multiple accept="image/*" className="hidden" onChange={e=>handlePhotoChange(index,e)}/>
                           </div>
                           {/* Preview Images */}
                           <div className="flex flex-wrap gap-1 mt-1">
                              {equipment.existingPhotoUrls?.map((url, i) => (
                                  <a key={`ex-${i}`} href={resolvePhotoUrl(url)} target="_blank" rel="noreferrer" className="w-8 h-8 border"><img src={resolvePhotoUrl(url)} className="w-full h-full object-cover"/></a>
                              ))}
                              {equipment.photoPreviews?.map((url, i) => (
                                  <div key={`new-${i}`} className="relative w-8 h-8 border">
                                     <img src={url} className="w-full h-full object-cover"/>
                                     <button onClick={()=>handleRemovePhoto(index,i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={8}/></button>
                                  </div>
                              ))}
                           </div>
                        </td>

                        <td className="sticky right-0 z-10 p-2 text-center bg-white group-hover:bg-slate-50">
                           <div className="flex justify-center gap-2">
                              <button type="button" onClick={() => viewEquipmentDetails(index)} className="text-blue-600 hover:bg-blue-100 p-1 rounded"><Eye size={16}/></button>
                              {!isEditMode && <button type="button" onClick={() => removeEquipmentRow(index)} className="text-red-600 hover:bg-red-100 p-1 rounded"><Trash2 size={16}/></button>}
                           </div>
                        </td>
                      </tr>
                      
                      {/* Customer Remark Display */}
                      {equipment.remarks_and_decision && (
                        <tr className="bg-yellow-50 border-b border-yellow-100">
                          <td className="sticky left-0 bg-yellow-50"></td>
                          {/* Adjust colspan based on visibility of columns */}
                          <td colSpan={11 + (isAnyOutsourced ? 3 : 0) + (showEngineerRemarksColumn ? 1 : 0)}>
                            <CustomerRemark remark={equipment.remarks_and_decision} />
                          </td>
                          <td className="sticky right-0 bg-yellow-50"></td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
           </div>
           
           {/* Add Equipment Button Below Table */}
           {!isEditMode && (
             <button 
                type="button" 
                onClick={addEquipmentRow} 
                className="mt-4 w-full py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 font-semibold hover:bg-blue-50 hover:border-blue-500 transition-colors flex items-center justify-center gap-2"
             >
                <Plus size={20} />
                <span>Add New Equipment Row</span>
             </button>
           )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-6 border-t mt-8">
          <button 
            type="submit" 
            disabled={!isFormReady || isLoading} 
            className="flex items-center space-x-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg text-lg shadow-lg transition-all transform hover:scale-105"
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : <FileText size={24} />}
            <span>{isEditMode ? 'Update Inward' : 'Preview & Submit'}</span>
          </button>
        </div>
      </form>

      {/* Modals */}
      {selectedEquipment && <EquipmentDetailsModal equipment={getModalEquipment()!} onClose={() => setSelectedEquipment(null)} />}
      {renderPreviewModal()}
      {renderEmailModal()}
      {renderAddCustomerModal()}
      {renderAddMaterialModal()}
    </div>
  );
};
 
export default InwardForm;5