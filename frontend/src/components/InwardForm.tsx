import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Eye, Barcode, Save, FileText, Loader2, ScanLine, X, Mail, ArrowLeft, Paperclip, Camera, Clock, Send, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import { InwardForm as InwardFormType, EquipmentDetail, InwardDetail } from '../types/inward';
import { generateSRFNo, commitUsedSRFNo, generateBarcode, generateQRCode } from '../utils/idGenerators';
import { EquipmentDetailsModal } from './EquipmentDetailsModal';
import { api, ENDPOINTS } from '../api/config';

// --- TYPE DEFINITIONS ---
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

// --- COMPONENT ---
export const InwardForm: React.FC = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const draftParam = searchParams.get('draft');
  const isEditMode = Boolean(editId);
  
  // State management
  const [formData, setFormData] = useState<InwardFormType>({
    srf_no: 'Loading...',
    date: new Date().toISOString().split('T')[0],
    customer_dc_date: new Date().toISOString().split('T')[0],
    receiver: '',
    customer_details: '',
    status: 'created'
  });
  const [equipmentList, setEquipmentList] = useState<EquipmentDetail[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(isEditMode || Boolean(draftParam));
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showStickerSheet, setShowStickerSheet] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState<{ [key: number]: boolean }>({});
  const [viewingCodesFor, setViewingCodesFor] = useState<EquipmentDetail | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [reportEmail, setReportEmail] = useState('');
  const [lastSavedInwardId, setLastSavedInwardId] = useState<number | null>(null);
  const [lastSavedSrfNo, setLastSavedSrfNo] = useState<string>('');
  
  // Auto-save system
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'unsaved'>('idle');
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);

  const isFormReady = !isLoadingData && formData.srf_no !== 'Loading...';
  const isAnyOutsourced = equipmentList.some(eq => eq.calibration_by === 'Outsource');
  const hasFormData = formData.customer_details.trim().length > 0 || equipmentList.some(eq => 
    (eq.material_desc || '').trim().length > 0
  );

  // --- INITIALIZATION AND LIFECYCLE ---
  useEffect(() => {
    if (isEditMode && editId) {
      loadInwardData(parseInt(editId));
    } else if (draftParam) {
      loadDraftData(parseInt(draftParam));
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
  }, [isEditMode, editId, draftParam]);

  // --- AUTO-SAVE SYSTEM (Every 2 seconds) ---
  useEffect(() => {
    if (!isEditMode && isFormReady && hasFormData) {
      const currentData = JSON.stringify({ formData, equipmentList });

      if (currentData !== lastSavedDataRef.current) {
        setDraftSaveStatus('unsaved');
        
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        
        autoSaveTimeoutRef.current = setTimeout(() => {
          triggerAutoSave(currentData);
        }, 2000);
      }
    }
  }, [formData, equipmentList, isFormReady, hasFormData]);

  const triggerAutoSave = async (dataToSave: string) => {
    if (!isFormReady || isEditMode) return;
    
    setDraftSaveStatus('saving');
    
    try {
      const draftPayload = {
        inward_id: currentDraftId,
        draft_data: {
          ...formData,
          equipment_list: equipmentList.map(({ photos, barcode_image, qrcode_image, ...rest }) => rest),
        }
      };

      const response = await api.patch<DraftSaveResponse>(ENDPOINTS.STAFF.DRAFT, draftPayload);
      
      if (response.data) { // Assuming a successful response contains data
        if (!currentDraftId && response.data.inward_id) {
          setCurrentDraftId(response.data.inward_id);
        }
        setDraftSaveStatus('saved');
        setLastAutoSaveTime(new Date());
        lastSavedDataRef.current = dataToSave;
      } else {
        throw new Error("Auto-save failed on the server.");
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      setDraftSaveStatus('error');
      
      setTimeout(() => {
        if (hasFormData) {
          triggerAutoSave(dataToSave);
        }
      }, 5000);
    }
  };

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    const currentData = JSON.stringify({ formData, equipmentList });
    if (hasFormData && !isEditMode && currentData !== lastSavedDataRef.current) {
      const message = 'You have unsaved changes that will be auto-saved. Continue anyway?';
      e.returnValue = message;
      return message;
    }
  };

  // --- DATA LOADING & INITIALIZATION ---
  const loadDraftData = async (draftId: number) => {
    try {
      setIsLoadingData(true);
      const response = await api.get<DraftLoadResponse>(`${ENDPOINTS.STAFF.DRAFTS}/${draftId}`);
      const draftData = response.data.draft_data;
      
      if (draftData) {
        const newFormData = {
          srf_no: draftData.srf_no || formData.srf_no,
          date: draftData.date || new Date().toISOString().split('T')[0],
          customer_dc_date: draftData.customer_dc_date || new Date().toISOString().split('T')[0],
          customer_details: draftData.customer_details || '',
          receiver: draftData.receiver || '',
          status: 'created' as const
        };
        const newEquipmentList = draftData.equipment_list || [];

        setFormData(newFormData);
        setEquipmentList(newEquipmentList);
        setCurrentDraftId(draftId);
        
        lastSavedDataRef.current = JSON.stringify({
            formData: newFormData,
            equipmentList: newEquipmentList
        });
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
    lastSavedDataRef.current = '';
    setDraftSaveStatus('idle');
    setLastAutoSaveTime(null);
    setEquipmentList([]);
    
    try {
      const srfNo = await generateSRFNo();
      const newFormData = {
        srf_no: srfNo,
        date: new Date().toISOString().split('T')[0],
        customer_dc_date: new Date().toISOString().split('T')[0],
        receiver: '',
        customer_details: '',
        status: 'created' as const
      };
      const newEquipmentList = [{ nepl_id: `${srfNo}-1`, material_desc: '', make: '', model: '', qty: 1, calibration_by: 'In Lab' as const }];
      setFormData(newFormData);
      setEquipmentList(newEquipmentList);
      lastSavedDataRef.current = JSON.stringify({ formData: newFormData, equipmentList: newEquipmentList });
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
          customer_dc_date: inward.customer_dc_date || inward.date,
          receiver: inward.receiver || '',
          customer_details: inward.customer_details,
          status: inward.status
        });
        const equipmentData = inward.equipments?.map((eq) => ({
          nepl_id: eq.nepl_id,
          material_desc: eq.material_description,
          make: eq.make,
          model: eq.model,
          range: eq.range || '',
          serial_no: eq.serial_no || '',
          qty: eq.quantity,
          inspe_notes: eq.visual_inspection_notes || '',
          calibration_by: 'In Lab' as const, // Adjust if outsource data is available
          remarks: eq.remarks || ''
        })) || [];
        setEquipmentList(equipmentData.length > 0 ? equipmentData : [{ nepl_id: `${inward.srf_no}-1`, material_desc: '', make: '', model: '', qty: 1, calibration_by: 'In Lab' as const }]);
      } catch (error) {
        console.error('Error loading inward data:', error);
        showMessage('error', 'Failed to load inward data.');
        navigate('/engineer/view-inward');
      } finally {
        setIsLoadingData(false);
      }
  };

  // --- FORM HANDLERS ---
  const handleBackToPortal = () => {
    const currentData = JSON.stringify({ formData, equipmentList });
    if (hasFormData && !isEditMode && currentData !== lastSavedDataRef.current) {
        if(!window.confirm('Your work is auto-saved as a draft. Are you sure you want to go back?')) {
            return;
        }
    }
    if (isEditMode) {
      navigate('/engineer/view-inward');
    } else {
      navigate('/engineer');
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEquipmentChange = (index: number, field: keyof EquipmentDetail, value: string | number) => {
    setEquipmentList(currentList => {
      const updatedList = [...currentList];
      if (!updatedList[index]) return currentList;
      const currentEquipment = { ...updatedList[index], [field]: value };
      if (field === 'calibration_by' && value !== 'Outsource') {
        delete currentEquipment.supplier;
        delete currentEquipment.in_dc;
        delete currentEquipment.out_dc;
      }
      updatedList[index] = currentEquipment;
      return updatedList;
    });
  };

  const handlePhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setEquipmentList(currentList => {
        const updatedList = [...currentList];
        updatedList[index] = { ...updatedList[index], photos: [...(updatedList[index].photos || []), ...newFiles] };
        return updatedList;
      });
    }
  };

  const handleRemovePhoto = (eqIndex: number, photoIndex: number) => {
    setEquipmentList(currentList => {
      const updatedList = [...currentList];
      const updatedPhotos = updatedList[eqIndex].photos?.filter((_, pIndex) => pIndex !== photoIndex);
      updatedList[eqIndex] = { ...updatedList[eqIndex], photos: updatedPhotos };
      return updatedList;
    });
  };

  const addEquipmentRow = () => {
    const newIndex = equipmentList.length + 1;
    const neplId = `${formData.srf_no}-${newIndex}`;
    setEquipmentList([...equipmentList, { nepl_id: neplId, material_desc: '', make: '', model: '', qty: 1, calibration_by: 'In Lab' as const }]);
  };

  const removeEquipmentRow = (index: number) => {
    if (equipmentList.length > 1) {
      const reindexedList = equipmentList.filter((_, i) => i !== index).map((item, i) => ({ ...item, nepl_id: `${formData.srf_no}-${i + 1}` }));
      setEquipmentList(reindexedList);
    }
  };

  const viewEquipmentDetails = (index: number) => setSelectedEquipment(equipmentList[index]);
  
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const generateCodesForEquipment = async (index: number) => {
    const equipment = equipmentList[index];
    if (!equipment || equipment.barcode_image || loadingCodes[index] || !equipment.nepl_id) return;
    setLoadingCodes(prev => ({ ...prev, [index]: true }));
    try {
      const inwardStatus = formData.status || 'created';
      const [barcode_image, qrcode_image] = await Promise.all([ generateBarcode(equipment.nepl_id), generateQRCode(inwardStatus) ]);
      setEquipmentList(currentList => {
        const updatedList = [...currentList];
        if (updatedList[index]) {
          updatedList[index] = { ...updatedList[index], barcode_image, qrcode_image };
        }
        return updatedList;
      });
    } catch (error) {
      console.error("Code generation failed:", error);
    } finally {
      setLoadingCodes(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleRowBlur = (index: number) => {
    if (!equipmentList[index].barcode_image) {
      generateCodesForEquipment(index);
    }
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
      if (!formData.receiver || !formData.customer_details) {
        throw new Error('Please fill in Receiver and Company Name & Address.');
      }
      if (equipmentList.some(eq => !eq.material_desc || !eq.make || !eq.model)) {
        throw new Error('Fill in Material Desc, Make, and Model for all equipment.');
      }

      const submissionData = new FormData();
      submissionData.append('date', formData.date);
      submissionData.append('customer_dc_date', formData.customer_dc_date);
      submissionData.append('receiver', formData.receiver);
      submissionData.append('customer_details', formData.customer_details);
      
      const equipmentDataForJson = equipmentList.map(({ photos, barcode_image, qrcode_image, ...rest }) => ({...rest, qty: Number(rest.qty)}));
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
        if (currentDraftId) {
          submissionData.append('inward_id', currentDraftId.toString());
        }
        
        const response = await api.post<InwardResponse>(ENDPOINTS.STAFF.SUBMIT, submissionData, { headers: { 'Content-Type': 'multipart/form-data' } });
        commitUsedSRFNo(response.data.srf_no.toString());
        showMessage('success', `Inward form SRF ${response.data.srf_no} finalized successfully!`);
        
        setShowEmailModal(true);
        setLastSavedInwardId(response.data.inward_id);
        setLastSavedSrfNo(String(response.data.srf_no));
        
        await initializeForm();
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

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportEmail || !lastSavedInwardId) return;
    try {
      await api.post(ENDPOINTS.STAFF.INWARD_SEND_REPORT(lastSavedInwardId), { email: reportEmail, send_later: false });
      showMessage('success', `Report for SRF ${lastSavedSrfNo} sent to ${reportEmail}!`);
      setShowEmailModal(false);
      setReportEmail('');
    } catch (error: any) {
      showMessage('error', error.response?.data?.detail || 'Failed to send report.');
    }
  };

  const handleSendLater = async () => {
    if (!lastSavedInwardId) return;
    try {
      await api.post(ENDPOINTS.STAFF.INWARD_SEND_REPORT(lastSavedInwardId), { send_later: true });
      showMessage('success', `Report for SRF ${lastSavedSrfNo} is scheduled.`);
      setShowEmailModal(false);
    } catch (error: any) {
      showMessage('error', error.response?.data?.detail || 'Failed to schedule email.');
    }
  };
  
  // --- UI HELPER FUNCTIONS & RENDER ---
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={() => setShowEmailModal(false)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4 p-8 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setShowEmailModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><X size={24} /></button>
        <div className="flex items-center space-x-4 mb-4"><Mail className="text-blue-600" size={36} /><h2 className="text-2xl font-bold text-gray-800">Report Delivery</h2></div>
        <p className="text-gray-600 mb-6">Inward SRF <strong>{lastSavedSrfNo}</strong> is finalized. Choose your delivery option.</p>
        <div className="space-y-6">
          <form onSubmit={handleSendEmail} className="p-4 border rounded-lg bg-gray-50">
            <label htmlFor="reportEmail" className="block text-sm font-medium text-gray-700 mb-2">Send Immediately</label>
            <div className="flex gap-2">
              <input id="reportEmail" type="email" value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} required placeholder="Enter customer's email..." className="flex-grow px-4 py-2 border border-gray-300 rounded-lg" />
              <button type="submit" disabled={!reportEmail} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-bold"><Send size={18} /><span>Send</span></button>
            </div>
          </form>
          <div className="p-4 border rounded-lg bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">Schedule for Later</label>
            <button type="button" onClick={handleSendLater} className="w-full flex items-center justify-center space-x-2 px-6 py-3 text-orange-700 bg-orange-100 border border-orange-300 rounded-lg hover:bg-orange-200 font-medium"><Clock size={20} /><span>Add to Scheduled Tasks</span></button>
          </div>
        </div>
      </div>
    </div>
  );

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
      <div className="flex flex-wrap items-center justify-between border-b pb-4 mb-6 gap-4">
        <div className="flex items-center space-x-4">
          <FileText className="h-8 w-8 text-blue-600" />
          <div><h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit Inward Form' : 'New Inward Form'}</h1></div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
            {!isEditMode && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg border border-gray-200">
                {getDraftStatusIcon()}
                <span className="font-medium">{getDraftStatusText()}</span>
              </div>
            )}
            <button type="button" onClick={handleBackToPortal} className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm">
              <ArrowLeft size={18} />
              <span>{isEditMode ? 'Back to List' : 'Back to Portal'}</span>
            </button>
        </div>
      </div>

      {!isEditMode && hasFormData && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <Save className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-900">Auto-Save Active</h3>
              <p className="text-sm text-blue-700">
                Your work is automatically saved. Feel free to resume anytime from the drafts section.
              </p>
            </div>
          </div>
        </div>
      )}

      {message && ( <div className={`my-4 px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}> {message.text} </div> )}

      <form onSubmit={handleSubmit}>
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-gray-50 rounded-lg border">
            <div><label className="block text-sm font-semibold text-gray-700 mb-2">Date *</label><input type="date" name="date" value={formData.date} onChange={handleFormChange} required className="w-full px-4 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-2">Customer DC Date *</label><input type="date" name="customer_dc_date" value={formData.customer_dc_date} onChange={handleFormChange} required className="w-full px-4 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-2">Receiver *</label><input type="text" name="receiver" value={formData.receiver} onChange={handleFormChange} required placeholder="Enter receiver username" className="w-full px-4 py-2 border rounded-lg" /></div>
            <div className="md:col-span-1"><label className="block text-sm font-semibold text-gray-700 mb-2">SRF No <span className="text-gray-500">(Auto)</span></label><input type="text" value={formData.srf_no} disabled className="w-full px-4 py-2 bg-gray-200 rounded-lg" /></div>
            <div className="md:col-span-2 lg:col-span-3"><label className="block text-sm font-semibold text-gray-700 mb-2">Company Name & Address *</label><input type="text" name="customer_details" value={formData.customer_details} onChange={handleFormChange} required placeholder="Enter company name and address" className="w-full px-4 py-2 border rounded-lg" /></div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2"><Wrench size={24} className="text-blue-600" />Equipment Details</h2></div>
          <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
            <table className="w-full text-sm border-collapse min-w-[1800px]">
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
                  {isAnyOutsourced && (<><th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[200px]">Supplier</th><th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[150px]">In DC</th><th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[150px]">Out DC</th></>)}
                  <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[200px]">Insp. Notes</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[250px]">Photos</th>
                  <th className="p-3 text-left text-xs font-semibold text-slate-600 uppercase border-b border-slate-200 min-w-[100px]">Codes</th>
                  <th className="sticky right-0 z-20 p-3 text-center text-xs font-semibold text-slate-600 uppercase bg-slate-100 border-b border-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {equipmentList.map((equipment, index) => (
                  <tr key={index} className="hover:bg-slate-50 group">
                    <td className="sticky left-0 z-10 p-3 text-center font-semibold text-slate-500 bg-white group-hover:bg-slate-50">{index + 1}</td>
                    <td className="p-2"><input type="text" value={equipment.nepl_id} disabled className="w-full bg-slate-100 font-medium px-2 py-1.5 border border-slate-200 rounded-md" /></td>
                    <td className="p-2"><input type="text" value={equipment.material_desc} onBlur={() => handleRowBlur(index)} onChange={(e) => handleEquipmentChange(index, 'material_desc', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" required /></td>
                    <td className="p-2"><input type="text" value={equipment.make} onBlur={() => handleRowBlur(index)} onChange={(e) => handleEquipmentChange(index, 'make', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" required /></td>
                    <td className="p-2"><input type="text" value={equipment.model} onBlur={() => handleRowBlur(index)} onChange={(e) => handleEquipmentChange(index, 'model', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" required /></td>
                    <td className="p-2"><input type="text" value={equipment.range || ''} onChange={(e) => handleEquipmentChange(index, 'range', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td>
                    <td className="p-2"><input type="text" value={equipment.serial_no || ''} onChange={(e) => handleEquipmentChange(index, 'serial_no', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td>
                    <td className="p-2"><input type="number" value={equipment.qty} min={1} onChange={(e) => handleEquipmentChange(index, 'qty', parseInt(e.target.value) || 1)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md text-center focus:ring-1 focus:ring-blue-500" required /></td>
                    <td className="p-2"><select className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" value={equipment.calibration_by} onChange={(e) => handleEquipmentChange(index, 'calibration_by', e.target.value)}><option value="In Lab">In Lab</option><option value="Outsource">Outsource</option><option value="Out Lab">Out Lab</option></select></td>
                    {equipment.calibration_by === 'Outsource' ? (<><td className="p-2"><input type="text" placeholder="Supplier" value={equipment.supplier || ''} onChange={(e) => handleEquipmentChange(index, 'supplier', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td><td className="p-2"><input type="text" placeholder="In DC" value={equipment.in_dc || ''} onChange={(e) => handleEquipmentChange(index, 'in_dc', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td><td className="p-2"><input type="text" placeholder="Out DC" value={equipment.out_dc || ''} onChange={(e) => handleEquipmentChange(index, 'out_dc', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td></>) : (isAnyOutsourced && <td colSpan={3} className="p-2 bg-slate-50"></td>)}
                    <td className="p-2"><textarea rows={1} value={equipment.inspe_notes || ''} onChange={(e) => handleEquipmentChange(index, 'inspe_notes', e.target.value)} className="w-full bg-transparent px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500" /></td>
                    <td className="p-2 align-middle"><div className="flex items-center gap-2"><label htmlFor={`photo-upload-${index}`} className="flex-shrink-0 flex items-center justify-center gap-1 cursor-pointer bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-3 py-1.5 rounded-md text-xs"><Camera size={14} /> Attach</label><input id={`photo-upload-${index}`} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handlePhotoChange(index, e)} />{equipment.photos && equipment.photos.length > 0 && (<div className="flex flex-wrap gap-1.5">{equipment.photos.map((photo: File, pIndex: number) => (<div key={pIndex} className="flex items-center bg-gray-100 p-1 rounded text-xs" title={photo.name}><Paperclip size={12} className="mr-1" /><span className="truncate max-w-[100px]">{photo.name}</span><button type="button" onClick={() => handleRemovePhoto(index, pIndex)} className="ml-1 text-red-500 hover:text-red-700"><X size={14} /></button></div>))}</div>)}</div></td>
                    <td className="p-2 align-middle text-center">{loadingCodes[index] ? <Loader2 className="animate-spin text-slate-400" /> : equipment.barcode_image ? (<button type="button" onClick={() => setViewingCodesFor(equipment)} className="p-2 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 rounded-full" title="View Codes"><ScanLine size={16} /></button>) : (<span className="text-slate-400 text-xs italic">Auto</span>)}</td>
                    <td className="sticky right-0 z-10 p-2 text-center bg-white group-hover:bg-slate-50"><div className="flex items-center justify-center gap-1"><button type="button" onClick={() => viewEquipmentDetails(index)} className="p-2 text-slate-500 hover:bg-blue-100 hover:text-blue-600 rounded-full" title="View Full Details"><Eye size={16} /></button><button type="button" onClick={() => removeEquipmentRow(index)} className="p-2 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full" title="Remove Row" disabled={equipmentList.length <= 1}><Trash2 size={16} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-4"><p className='text-sm text-slate-500'>Add all incoming equipment using the button on the right.</p><div className='flex gap-4'><button type="button" onClick={() => setShowStickerSheet(true)} className="flex items-center space-x-2 bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 font-semibold"><Barcode size={20} /><span>Print Stickers</span></button><button type="button" onClick={addEquipmentRow} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold"><Plus size={20} /><span>Add Another Equipment</span></button></div></div>
        </div>
        <div className="flex justify-end pt-6 border-t mt-8"><button type="submit" disabled={!isFormReady || isLoading} className="flex items-center space-x-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg text-lg">{isLoading ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}<span>{isLoading ? (isEditMode ? 'Updating...' : 'Finalizing...') : (isEditMode ? 'Update Inward Form' : currentDraftId ? 'Finalize Draft' : 'Save Inward Form')}</span></button></div>
      </form>

      {selectedEquipment && <EquipmentDetailsModal equipment={selectedEquipment} onClose={() => setSelectedEquipment(null)} />}
      {viewingCodesFor && ( <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={() => setViewingCodesFor(null)}> <div className="bg-white rounded-lg shadow-2xl w-full max-w-md m-4 p-6 relative" onClick={(e) => e.stopPropagation()}> <button onClick={() => setViewingCodesFor(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"><X size={24} /></button> <h2 className="text-2xl font-bold text-gray-800 mb-2">Generated Codes for ID</h2> <p className="text-lg text-blue-600 font-semibold mb-6">{viewingCodesFor.nepl_id}</p> <div className="space-y-6 text-center"> <div> <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">1D Barcode (for Scanners)</h3> {viewingCodesFor.barcode_image ? (<div className="bg-white p-4 border rounded-md inline-block"><img src={viewingCodesFor.barcode_image} alt="Barcode" className="h-16" /></div>) : (<p>Not generated</p>)} <p className="text-gray-700 mt-2 font-mono">{viewingCodesFor.nepl_id}</p> </div> <div> <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Status QR Code</h3> {viewingCodesFor.qrcode_image ? (<div className="bg-white p-2 border rounded-md inline-block"><img src={viewingCodesFor.qrcode_image} alt="QR Code" className="h-40 w-40" /></div>) : (<p>Not generated</p>)} </div> </div> <div className="mt-8 text-center"> <button onClick={() => setViewingCodesFor(null)} className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-700">Close</button> </div> </div> </div> )}
      {renderEmailModal()}
      {showStickerSheet && ( <div className="fixed inset-0 z-[100] bg-white p-6 overflow-auto print:overflow-visible print:p-2"> <div className="flex justify-between items-center mb-6 print:hidden"> <h2 className="text-2xl font-bold">Sticker Sheet</h2> <div className="space-x-2"> <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Print</button> <button onClick={() => setShowStickerSheet(false)} className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded">Close</button> </div> </div> <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 print:grid-cols-3 print:gap-1"> {equipmentList.map((item, index) => ( <div key={index} className="border border-gray-400 rounded-lg p-2 text-center text-xs break-inside-avoid flex flex-col items-center justify-around aspect-video"> <p className="font-bold text-sm w-full truncate">{item.nepl_id}</p> {item.barcode_image && <img src={item.barcode_image} alt="Barcode" className="mx-auto h-10 w-full object-contain my-1" />} {item.qrcode_image && (<div className="flex items-center gap-2"><p className='font-semibold'>Status:</p><img src={item.qrcode_image} alt="QR Code" className="mx-auto w-16 h-16" /></div>)} {!item.barcode_image && <p className="text-gray-500 m-auto">Codes not generated</p>} </div> ))} </div> </div> )}
    </div>
  );
};