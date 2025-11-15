import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Eye, Save, FileText, Loader2, X, ArrowLeft, Camera, Clock, Send, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import { InwardForm as InwardFormType, EquipmentDetail, InwardDetail } from '../types/inward';
import { generateSRFNo, commitUsedSRFNo } from '../utils/idGenerators';
import { EquipmentDetailsModal } from './EquipmentDetailsModal';
import { api, ENDPOINTS, BACKEND_ROOT_URL } from '../api/config';
import { CustomerRemark } from './CustomerRemarks';
import { useAuth } from '../auth/AuthProvider';

// --- TYPE DEFINITIONS ---
interface CustomerDropdownItem {
  customer_id: number;
  customer_details: string;
}

interface InwardResponse {
  inward_id: number;
  srf_no: string;
}

interface SimpleAxiosError {
  isAxiosError: true;
  response?: { data?: any; status?: number; };
  message: string;
}

interface DraftSaveResponse {
  inward_id: number;
  draft_updated_at: string;
  customer_details?: string;
  draft_data: Record<string, any>;
}

interface LoadedDraftData {
  srf_no: string;
  date: string;
  customer_dc_date: string;
  customer_id: number | null; 
  customer_details: string;
  receiver: string;
  equipment_list: EquipmentDetail[];
}

interface DraftLoadResponse {
  draft_data: LoadedDraftData;
}

function isSimpleAxiosError(error: unknown): error is SimpleAxiosError {
  return typeof error === 'object' && error !== null && (error as any).isAxiosError === true;
}

type InwardFormProps = {
  initialDraftId: number | null;
};

// --- COMPONENT ---
export const InwardForm: React.FC<InwardFormProps> = ({ initialDraftId }) => {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEditMode = Boolean(editId);
  const { user } = useAuth();

  const [formData, setFormData] = useState<InwardFormType>({
    srf_no: 'Loading...',
    date: new Date().toISOString().split('T')[0],
    customer_dc_date: '',
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
  
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [reportEmail, setReportEmail] = useState('');
  const [lastSavedInwardId, setLastSavedInwardId] = useState<number | null>(null);
  const [lastSavedSrfNo, setLastSavedSrfNo] = useState<string>('');
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const previewUrlsRef = useRef<string[]>([]);

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
    (payload?: { formData: InwardFormType; equipmentList: EquipmentDetail[] }) => {
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
  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'unsaved'>('idle');
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(initialDraftId);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);

  const [customers, setCustomers] = useState<CustomerDropdownItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const isFormReady = !isLoadingData && formData.srf_no !== 'Loading...';
  const isAnyOutsourced = equipmentList.some(eq => eq.calibration_by === 'Outsource');
  const hasFormData =
    (formData.customer_id !== null && formData.customer_id !== undefined) ||
    (formData.customer_dc_date ?? '').trim().length > 0 ||
    equipmentList.some((eq) => {
      const hasTextData = (eq.material_desc || '').trim().length > 0;
      const hasAttachments =
        (Array.isArray(eq.photos) && eq.photos.length > 0) ||
        (Array.isArray(eq.photoPreviews) && eq.photoPreviews.length > 0) ||
        (Array.isArray(eq.existingPhotoUrls) && eq.existingPhotoUrls.length > 0);
      return hasTextData || hasAttachments;
    });

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await api.get<CustomerDropdownItem[]>(ENDPOINTS.PORTAL.CUSTOMERS_DROPDOWN);
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to fetch customers for dropdown:', error);
      showMessage('error', 'Failed to load customer list.');
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    if (isEditMode && editId) {
      loadInwardData(parseInt(editId));
    } else if (initialDraftId) {
      loadDraftData(initialDraftId);
    } else {
      initializeForm();
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editId, initialDraftId, fetchCustomers]);

  useEffect(() => {
    return () => {
      cleanupAllPreviews();
    };
  }, [cleanupAllPreviews]);

  useEffect(() => {
    if (!isEditMode && isFormReady && hasFormData) {
      const currentData = serializeDraftState();
      if (currentData !== lastSavedDataRef.current) {
        setDraftSaveStatus('unsaved');
        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = setTimeout(() => triggerAutoSave(currentData), 2000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, equipmentList, isFormReady, hasFormData, isEditMode, serializeDraftState]);

  useEffect(() => {
    if (!selectedEquipment) return;
    const index = equipmentList.findIndex(eq => eq.nepl_id === selectedEquipment.nepl_id);
    if (index !== -1 && equipmentList[index] !== selectedEquipment) {
      setSelectedEquipment(equipmentList[index]);
    }
  }, [equipmentList, selectedEquipment]);

  const triggerAutoSave = async (dataToSave: string) => {
    if (!isFormReady || isEditMode) return;
    setDraftSaveStatus('saving');
    try {
      const equipmentDraftPayload = equipmentList.map(({ photos, photoPreviews, existingPhotoUrls, barcode_image, qrcode_image, ...rest }) => {
        const normalizedQty = Number(rest.qty ?? 1);
        return {
          ...rest,
          qty: Number.isFinite(normalizedQty) ? normalizedQty : 1,
          inspe_notes: rest.inspe_notes || 'OK',
          existing_photo_urls: (existingPhotoUrls || []).filter((url): url is string => Boolean(url?.trim()))
        };
      });

      const draftPayload = {
        inward_id: currentDraftId,
        draft_data: {
          ...formData,
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
        let updatedEquipmentListState = equipmentList.map((equipment) => {
          const sanitizedExisting = (equipment.existingPhotoUrls || []).filter((url): url is string => Boolean(url?.trim()));
          return {
            ...equipment,
            existingPhotoUrls: sanitizedExisting,
            photos: equipment.photos || [],
            photoPreviews: equipment.photoPreviews || []
          };
        });

        if (Array.isArray(response.data?.draft_data?.equipment_list)) {
          updatedEquipmentListState = updatedEquipmentListState.map((equipment, index) => {
            const serverEquipment = (response.data?.draft_data?.equipment_list as any[])[index];
            if (!serverEquipment || typeof serverEquipment !== 'object') {
              return equipment;
            }
            const {
              existing_photo_urls,
              existingPhotoUrls,
              photos: _serverPhotos,
              photoPreviews: _serverPreviews,
              ...rest
            } = serverEquipment;
            const serverExisting =
              (Array.isArray(existing_photo_urls) ? existing_photo_urls : Array.isArray(existingPhotoUrls) ? existingPhotoUrls : []) as unknown[];
            const normalizedExisting = serverExisting
              .filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
            return {
              ...equipment,
              ...rest,
              existingPhotoUrls: normalizedExisting,
              photos: equipment.photos || [],
              photoPreviews: equipment.photoPreviews || []
            };
          });
        }

        setEquipmentList(updatedEquipmentListState);
        setDraftSaveStatus('saved');
        setLastAutoSaveTime(new Date());
        lastSavedDataRef.current = serializeDraftState({ formData, equipmentList: updatedEquipmentListState });
      } else {
        throw new Error("Auto-save failed on the server.");
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      setDraftSaveStatus('error');
      setTimeout(() => { if (hasFormData) triggerAutoSave(dataToSave); }, 5000);
    }
  };

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    const currentData = JSON.stringify({ formData, equipmentList });
    if (hasFormData && !isEditMode && currentData !== lastSavedDataRef.current) {
      const message = 'You have unsaved changes. Are you sure you want to leave?';
      e.returnValue = message;
      return message;
    }
  };

  const loadDraftData = async (draftId: number) => {
    setIsLoadingData(true);
    try {
      const response = await api.get<DraftLoadResponse>(`${ENDPOINTS.STAFF.DRAFTS}/${draftId}`);
      const draftData = response.data.draft_data;
      if (draftData) {
        const newFormData = {
          srf_no: draftData.srf_no || formData.srf_no,
          date: draftData.date || new Date().toISOString().split('T')[0],
          customer_dc_date: draftData.customer_dc_date ?? '',
          customer_id: draftData.customer_id || null,
          customer_details: draftData.customer_details || '',
          receiver: draftData.receiver || '',
          status: 'created' as const
        };
        const newEquipmentList = (draftData.equipment_list || []).map(eq => {
          const existingPhotoUrls = (() => {
            if (Array.isArray((eq as any).existingPhotoUrls)) return (eq as any).existingPhotoUrls;
            if (Array.isArray((eq as any).existing_photo_urls)) return (eq as any).existing_photo_urls;
            if (Array.isArray((eq as any).photos)) return (eq as any).photos;
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
        cleanupAllPreviews();
        const normalizedEquipmentList = newEquipmentList.length > 0 ? newEquipmentList : [{
          nepl_id: `${newFormData.srf_no}-1`,
          material_desc: '',
          make: '',
          model: '',
          qty: 1,
          calibration_by: 'In Lab' as const,
          inspe_notes: 'OK',
          photos: [],
          photoPreviews: [],
          existingPhotoUrls: []
        }];
        setEquipmentList(normalizedEquipmentList);
        setCurrentDraftId(draftId);
        lastSavedDataRef.current = serializeDraftState({ formData: newFormData, equipmentList: normalizedEquipmentList });
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
    try {
      const srfNo = await generateSRFNo();
      const newFormData = {
        srf_no: srfNo,
        date: new Date().toISOString().split('T')[0],
        customer_dc_date: '',
        receiver: user?.full_name || user?.username || '',
        customer_id: null,
        customer_details: '',
        status: 'created' as const
      };
      const newEquipmentList = [{ 
        nepl_id: `${srfNo}-1`, 
        material_desc: '', 
        make: '', 
        model: '', 
        qty: 1, 
        calibration_by: 'In Lab' as const,
        inspe_notes: 'OK',
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
      showMessage('error', error.message || 'Failed to initialize form.');
      setFormData(prev => ({ ...prev, srf_no: 'Error!' }));
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadInwardData = async (inwardId: number) => {
    setIsLoadingData(true);
    try {
      const response = await api.get<InwardDetail>(`${ENDPOINTS.STAFF.INWARDS}/${inwardId}`);
      const inward = response.data;
      setFormData({
        srf_no: inward.srf_no.toString(),
        date: inward.date,
        customer_dc_date: inward.customer_dc_date ?? inward.date ?? '',
        receiver: inward.receiver || '',
        customer_id: inward.customer_id,
        customer_details: inward.customer_details,
        status: inward.status
      });
      setSelectedCustomerId(inward.customer_id);
      
      const equipmentData = (inward.equipments ?? []).map((eq) => {
        const calibrationBy = (['In Lab', 'Outsource', 'Out Lab'] as const).includes((eq.calibration_by || 'In Lab') as any)
          ? (eq.calibration_by as 'In Lab' | 'Outsource' | 'Out Lab')
          : 'In Lab';
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
          inspe_notes: eq.visual_inspection_notes || 'OK',
          calibration_by: calibrationBy,
          remarks_and_decision: eq.remarks_and_decision,
          photos: [],
          photoPreviews: [],
          existingPhotoUrls
        };
      });
      
      cleanupAllPreviews();
      setEquipmentList(equipmentData.length > 0 ? equipmentData : [{ 
        nepl_id: `${inward.srf_no}-1`, 
        material_desc: '', 
        make: '', 
        model: '', 
        qty: 1, 
        calibration_by: 'In Lab' as const,
        inspe_notes: 'OK',
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

  const handleBackToPortal = () => {
    if (hasFormData && !isEditMode && JSON.stringify({ formData, equipmentList }) !== lastSavedDataRef.current) {
        if(!window.confirm('You have unsaved changes. Are you sure you want to go back?')) {
            return;
        }
    }
    // --- MODIFICATION: Navigate to correct page based on edit mode ---
    if (isEditMode) {
        navigate('/engineer/view-inward');
    } else {
        navigate('/engineer/create-inward');
    }
  };

  const handleCloseEmailModalAndNavigate = () => {
    setShowEmailModal(false);
    navigate('/engineer/create-inward', { replace: true });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'customer_id') {
      const customerId = parseInt(value);
      const selectedCustomer = customers.find(c => c.customer_id === customerId);
      setFormData(prev => ({
        ...prev,
        customer_id: customerId,
        customer_details: selectedCustomer ? selectedCustomer.customer_details : ''
      }));
      setSelectedCustomerId(customerId);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEquipmentChange = (index: number, field: keyof EquipmentDetail, value: string | number) => {
    setEquipmentList(currentList => {
      const updatedList = [...currentList];
      if (!updatedList[index]) return currentList;
      const currentEquipment = { ...updatedList[index], [field]: value };
      if (field === 'calibration_by' && value !== 'Outsource') {
        delete (currentEquipment as any).supplier;
        delete (currentEquipment as any).in_dc;
        delete (currentEquipment as any).out_dc;
      }
      updatedList[index] = currentEquipment;
      return updatedList;
    });
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
        inspe_notes: 'OK',
        photos: [],
        photoPreviews: [],
        existingPhotoUrls: []
      }];
    });
  };

  const removeEquipmentRow = (index: number) => {
    setEquipmentList(currentList => {
      if (currentList.length <= 1) return currentList;
      const equipmentToRemove = currentList[index];
      equipmentToRemove?.photoPreviews?.forEach(url => {
        URL.revokeObjectURL(url);
        previewUrlsRef.current = previewUrlsRef.current.filter(existing => existing !== url);
      });
      const reindexedList = currentList
        .filter((_, i) => i !== index)
        .map((item, i) => ({ 
          ...item, 
          nepl_id: `${formData.srf_no}-${i + 1}` 
        }));
      return reindexedList;
    });
  };

  const viewEquipmentDetails = (index: number) => setSelectedEquipment(equipmentList[index]);
  
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    setIsLoading(true);

    if (formData.srf_no === 'Loading...' || formData.srf_no === 'Error!') {
      showMessage('error', 'SRF Number is not ready. Please refresh.');
      setIsLoading(false);
      return;
    }

    try {
      if (!formData.receiver || formData.customer_id === null) throw new Error('Please fill in Receiver and select a Company Name & Address.');
      if (equipmentList.some(eq => !eq.material_desc || !eq.make || !eq.model)) throw new Error('Fill in Material Desc, Make, and Model for all equipment.');

      const submissionData = new FormData();
      submissionData.append('date', formData.date);
      submissionData.append('customer_dc_date', formData.customer_dc_date);
      submissionData.append('receiver', formData.receiver);
      submissionData.append('customer_id', formData.customer_id.toString());
      submissionData.append('customer_details', formData.customer_details);
      
      const equipmentDataForJson = equipmentList.map(({ photos, photoPreviews, existingPhotoUrls, barcode_image, qrcode_image, ...rest }) => ({
        ...rest,
        qty: Number(rest.qty),
        inspe_notes: rest.inspe_notes || 'OK',
        existing_photo_urls: (existingPhotoUrls || []).filter((url): url is string => Boolean(url?.trim()))
      }));
      submissionData.append('equipment_list', JSON.stringify(equipmentDataForJson));
      
      equipmentList.forEach((equipment, index) => {
        equipment.photos?.forEach((photoFile: File) => submissionData.append(`photos_${index}`, photoFile, photoFile.name));
      });

      if (isEditMode && editId) {
        submissionData.append('srf_no', formData.srf_no);
        const response = await api.put<InwardResponse>(`${ENDPOINTS.STAFF.INWARDS}/${editId}`, submissionData, { headers: { 'Content-Type': 'multipart/form-data' } });
        showMessage('success', `Inward SRF ${response.data.srf_no} updated successfully!`);
        navigate('/engineer/view-inward');
      } else {
        submissionData.append('srf_no', formData.srf_no);

        if (currentDraftId) submissionData.append('inward_id', currentDraftId.toString());
        const response = await api.post<InwardResponse>(ENDPOINTS.STAFF.SUBMIT, submissionData, { headers: { 'Content-Type': 'multipart/form-data' } });
        commitUsedSRFNo(response.data.srf_no.toString());
        showMessage('success', `Inward SRF ${response.data.srf_no} submitted. Please notify the customer.`);
        setShowEmailModal(true);
        setLastSavedInwardId(response.data.inward_id);
        setLastSavedSrfNo(String(response.data.srf_no));
      }
    } catch (error: unknown) {
      if (isSimpleAxiosError(error)) {
        const detail = error.response?.data?.detail;
        const errorMessage = Array.isArray(detail) ? detail[0].msg : detail || 'An error occurred.';
        showMessage('error', errorMessage);
      } else if (error instanceof Error) {
        showMessage('error', error.message);
      } else {
        showMessage('error', 'An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendFir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportEmail || !lastSavedInwardId) return;
    try {
      await api.post(`${ENDPOINTS.STAFF.INWARDS}/${lastSavedInwardId}/send-report`, { email: reportEmail, send_later: false });
      showMessage('success', `FIR for SRF ${lastSavedSrfNo} sent to ${reportEmail}!`);
      setReportEmail('');
      handleCloseEmailModalAndNavigate();
    } catch (error: any) {
      showMessage('error', error.response?.data?.detail || 'Failed to send FIR.');
    }
  };

  const handleScheduleFir = async () => {
    if (!lastSavedInwardId) return;
    try {
      await api.post(`${ENDPOINTS.STAFF.INWARDS}/${lastSavedInwardId}/send-report`, { send_later: true });
      showMessage('success', `FIR for SRF ${lastSavedSrfNo} is scheduled.`);
      handleCloseEmailModalAndNavigate();
    } catch (error: any) {
      showMessage('error', error.response?.data?.detail || 'Failed to schedule FIR.');
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

  const renderEmailModal = () => !showEmailModal ? null : (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={handleCloseEmailModalAndNavigate}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4 p-8 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleCloseEmailModalAndNavigate} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><X size={24} /></button>
        <div className="flex items-center space-x-4 mb-4">
          <Send className="text-blue-600" size={36} />
          <h2 className="text-2xl font-bold text-gray-800">Send Inward Report to Customer</h2>
        </div>
        <p className="text-gray-600 mb-6">The inward for SRF <strong>{lastSavedSrfNo}</strong> is complete. You can now notify the customer by sending the First Inspection Report (FIR).</p>
        <div className="space-y-6">
          <form onSubmit={handleSendFir} className="p-4 border rounded-lg bg-gray-50">
            <label htmlFor="reportEmail" className="block text-sm font-medium text-gray-700 mb-2">Send FIR Immediately</label>
            <div className="flex gap-2">
              <input id="reportEmail" type="email" value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} required placeholder="Enter customer's email..." className="flex-grow px-4 py-2 border border-gray-300 rounded-lg" />
              <button type="submit" disabled={!reportEmail} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-bold"><Send size={18} /><span>Send FIR</span></button>
            </div>
          </form>
          <div className="p-4 border rounded-lg bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">Schedule for Later</label>
            <button type="button" onClick={handleScheduleFir} className="w-full flex items-center justify-center space-x-2 px-6 py-3 text-orange-700 bg-orange-100 border border-orange-300 rounded-lg hover:bg-orange-200 font-medium"><Clock size={20} /><span>Add to Scheduled Tasks</span></button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoadingData) {
    return (<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-blue-600" size={48} /><span className="ml-4 text-xl text-gray-700">Loading Form...</span></div>);
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100">
      <div className="flex flex-wrap items-center justify-between border-b pb-4 mb-6 gap-4">
        <div className="flex items-center space-x-4">
          <FileText className="h-8 w-8 text-blue-600" />
          <div><h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit Inward Form' : 'New Inward Form'}</h1></div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
            {!isEditMode && (<div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg border border-gray-200">{getDraftStatusIcon()}<span className="font-medium">{getDraftStatusText()}</span></div>)}
            {/* --- MODIFICATION START: Conditional Button Text --- */}
            <button 
              type="button" 
              onClick={handleBackToPortal} 
              className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm"
            >
              <ArrowLeft size={18} />
              <span>{isEditMode ? 'Back to List' : 'Back to Drafts'}</span>
            </button>
            {/* --- MODIFICATION END --- */}
        </div>
      </div>

      {!isEditMode && hasFormData && (<div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"><div className="flex items-center gap-3"><Save className="h-5 w-5 text-blue-600" /><div><h3 className="font-semibold text-blue-900">Auto-Save Active</h3><p className="text-sm text-blue-700">Your work is automatically saved. Feel free to resume anytime from the drafts section.</p></div></div></div>)}
      {message && ( <div className={`my-4 px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div> )}

      <form onSubmit={handleSubmit}>
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-gray-50 rounded-lg border">
            <div><label className="block text-sm font-semibold text-gray-700 mb-2">Date *</label><input type="date" name="date" value={formData.date} onChange={handleFormChange} required className="w-full px-4 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-2">Customer DC Date *</label><input type="text" name="customer_dc_date" value={formData.customer_dc_date} onChange={handleFormChange} required placeholder="Enter Customer DC details" className="w-full px-4 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-2">Receiver *</label><input type="text" name="receiver" value={formData.receiver} onChange={handleFormChange} required placeholder="Enter receiver username" className="w-full px-4 py-2 border rounded-lg" /></div>
            <div className="md:col-span-1"><label className="block text-sm font-semibold text-gray-700 mb-2">SRF No <span className="text-gray-500">(Auto)</span></label><input type="text" value={formData.srf_no} disabled className="w-full px-4 py-2 bg-gray-200 rounded-lg" /></div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name & Address *</label>
              <select
                name="customer_id"
                value={selectedCustomerId || ''}
                onChange={handleFormChange}
                required
                className="w-full px-4 py-2 border rounded-lg bg-white"
                disabled={isEditMode}
              >
                <option value="">Select Company</option>
                {customers.map(customer => (
                  <option key={customer.customer_id} value={customer.customer_id}>
                    {customer.customer_details}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2"><Wrench size={24} className="text-blue-600" />Equipment Details</h2>
            {!isEditMode && (
              <button type="button" onClick={addEquipmentRow} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold"><Plus size={20} /><span>Add Equipment</span></button>
            )}
          </div>
          <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
            <table className="w-full text-sm border-collapse min-w-[2000px]">
              <thead className="bg-slate-100">
                <tr>
                  <th className="sticky left-0 z-20 p-3 text-center text-xs font-semibold text-slate-600 uppercase bg-slate-100 border-b border-slate-200">#</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[160px]">NEPL ID</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[250px]">Material Desc *</th>
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
                  <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[200px]">Visual Inspection</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[250px]">Photos</th>
                  <th className="sticky right-0 z-20 p-3 text-center text-xs font-semibold text-slate-600 uppercase bg-slate-100 border-b border-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {equipmentList.map((equipment, index) => (
                  <React.Fragment key={index}>
                    <tr className={`hover:bg-slate-50 group ${equipment.inspe_notes && equipment.inspe_notes.toUpperCase() !== 'OK' ? 'bg-orange-50' : ''} ${equipment.remarks_and_decision ? 'border-b-0' : ''}`}>
                      <td className="sticky left-0 z-10 p-3 text-center font-semibold text-slate-500 bg-white group-hover:bg-slate-50">{index + 1}</td>
                      <td className="p-2"><input type="text" value={equipment.nepl_id} disabled className="w-full bg-slate-100 font-medium px-2 py-1.5 border border-slate-200 rounded-md" /></td>
                      <td className="p-2"><input type="text" value={equipment.material_desc} onChange={(e) => handleEquipmentChange(index, 'material_desc', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" required /></td>
                      <td className="p-2"><input type="text" value={equipment.make} onChange={(e) => handleEquipmentChange(index, 'make', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" required /></td>
                      <td className="p-2"><input type="text" value={equipment.model} onChange={(e) => handleEquipmentChange(index, 'model', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" required /></td>
                      <td className="p-2"><input type="text" value={equipment.range || ''} onChange={(e) => handleEquipmentChange(index, 'range', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td>
                      <td className="p-2"><input type="text" value={equipment.serial_no || ''} onChange={(e) => handleEquipmentChange(index, 'serial_no', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td>
                      <td className="p-2"><input type="number" value={equipment.qty} min={1} onChange={(e) => handleEquipmentChange(index, 'qty', parseInt(e.target.value) || 1)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md text-center focus:ring-1 focus:ring-blue-500" required /></td>
                      <td className="p-2">
                        <select className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" value={equipment.calibration_by} onChange={(e) => handleEquipmentChange(index, 'calibration_by', e.target.value)}>
                          <option value="In Lab">In Lab</option>
                          <option value="Outsource">Outsource</option>
                          <option value="Out Lab">Out Lab</option>
                        </select>
                      </td>
                      {equipment.calibration_by === 'Outsource' ? (
                        <>
                          <td className="p-2"><input type="text" placeholder="Supplier" value={equipment.supplier || ''} onChange={(e) => handleEquipmentChange(index, 'supplier', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td>
                          <td className="p-2"><input type="text" placeholder="In DC" value={equipment.in_dc || ''} onChange={(e) => handleEquipmentChange(index, 'in_dc', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td>
                          <td className="p-2"><input type="text" placeholder="Out DC" value={equipment.out_dc || ''} onChange={(e) => handleEquipmentChange(index, 'out_dc', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td>
                        </>
                      ) : ( isAnyOutsourced && <td colSpan={3} className="p-2 bg-slate-50"></td> )}
                      
                      <td className="p-2">
                        <input
                          type="text"
                          value={equipment.inspe_notes || 'OK'}
                          onChange={(e) => handleEquipmentChange(index, 'inspe_notes', e.target.value)}
                          placeholder="OK, or describe issue"
                          className={`w-full px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-blue-500 ${
                            (!equipment.inspe_notes || equipment.inspe_notes.trim().toUpperCase() === 'OK')
                              ? 'bg-green-50 border-green-200 text-green-800' 
                              : 'bg-orange-50 border-orange-300 text-orange-800'
                          }`}
                        />
                      </td>
                      
                      <td className="p-2 align-middle">
                        <div className="flex items-center gap-2">
                          <label htmlFor={`photo-upload-${index}`} className="flex-shrink-0 flex items-center justify-center gap-1 cursor-pointer bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-3 py-1.5 rounded-md text-xs"><Camera size={14} /> Attach</label>
                          <input id={`photo-upload-${index}`} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handlePhotoChange(index, e)} />
                        </div>
                        {equipment.existingPhotoUrls && equipment.existingPhotoUrls.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Existing</p>
                            <div className="flex flex-wrap gap-2">
                              {equipment.existingPhotoUrls.map((url, existingIndex) => {
                                const resolved = resolvePhotoUrl(url);
                                if (!resolved) return null;
                                return (
                                  <a
                                    key={`${url}-${existingIndex}`}
                                    href={resolved}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block h-16 w-16 overflow-hidden rounded border border-slate-200 hover:border-blue-400"
                                    title="Open image in new tab"
                                  >
                                    <img src={resolved} alt={`Existing equipment image ${existingIndex + 1}`} className="h-full w-full object-cover" />
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {equipment.photoPreviews && equipment.photoPreviews.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">New Attachments</p>
                            <div className="flex flex-wrap gap-2">
                              {equipment.photoPreviews.map((preview, pIndex) => (
                                <div key={pIndex} className="relative h-16 w-16 overflow-hidden rounded border border-slate-200 shadow-sm">
                                  <img src={preview} alt={`New equipment image ${pIndex + 1}`} className="h-full w-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePhoto(index, pIndex)}
                                    className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-red-500 hover:bg-white hover:text-red-600 shadow focus:outline-none focus:ring-2 focus:ring-red-400"
                                    aria-label={`Remove image ${pIndex + 1}`}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="sticky right-0 z-10 p-2 text-center bg-white group-hover:bg-slate-50">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => viewEquipmentDetails(index)} className="p-2 text-slate-500 hover:bg-blue-100 hover:text-blue-600 rounded-full" title="View Full Details"><Eye size={16} /></button>
                          {!isEditMode && (
                            <button 
                              type="button" 
                              onClick={() => removeEquipmentRow(index)} 
                              className="p-2 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full" 
                              title="Remove Row" 
                              disabled={equipmentList.length <= 1}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {equipment.remarks_and_decision && (
                      <tr className="bg-yellow-50/70">
                        <td className="sticky left-0 z-10 p-2 bg-yellow-50/70"></td>
                        <td colSpan={isAnyOutsourced ? 12 : 9} className="p-0">
                          <CustomerRemark remark={equipment.remarks_and_decision} />
                        </td>
                        <td className="sticky right-0 z-10 p-2 bg-yellow-50/70"></td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-4">
            <p className='text-sm text-slate-500'>Add all incoming equipment and mark any deviations in the Visual Inspection column.</p>
            {!isEditMode && (
              <button type="button" onClick={addEquipmentRow} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold"><Plus size={20} /><span>Add Equipment</span></button>
            )}
          </div>
        </div>
        
        <div className="flex justify-end pt-6 border-t mt-8">
          <button type="submit" disabled={!isFormReady || isLoading} className="flex items-center space-x-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg text-lg">
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
            <span>{isLoading ? (isEditMode ? 'Updating...' : 'Submitting...') : (isEditMode ? 'Update Inward' : 'Submit Inward')}</span>
          </button>
        </div>
      </form>

      {selectedEquipment && <EquipmentDetailsModal equipment={selectedEquipment} onClose={() => setSelectedEquipment(null)} />}
      {renderEmailModal()}
    </div>
  ); 
};

export default InwardForm;