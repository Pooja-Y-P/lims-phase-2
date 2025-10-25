import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Eye, Barcode, Save, FileText, Loader2, ScanLine, X, Mail, ArrowLeft, Paperclip, Camera, Clock, Send } from 'lucide-react';
import { InwardForm as InwardFormType, EquipmentDetail } from '../types/inward';
import { generateSRFNo, generateBarcode, generateQRCode } from '../utils/idGenerators';
import { EquipmentDetailsModal } from './EquipmentDetailsModal';
import { api, ENDPOINTS } from '../api/config';

interface InwardResponse {
  inward_id: number;
  srf_no: number;
}

interface SimpleAxiosError {
  isAxiosError: true;
  response?: { data?: any; status?: number; };
  message: string;
}

function isSimpleAxiosError(error: unknown): error is SimpleAxiosError {
  return typeof error === 'object' && error !== null && (error as any).isAxiosError === true;
}

export const InwardForm: React.FC = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<InwardFormType>({ 
    srf_no: 'Loading...', 
    date: new Date().toISOString().split('T')[0], 
    customer_dc_date: new Date().toISOString().split('T')[0], 
    receiver: '', 
    customer_details: '',
  });
  const [equipmentList, setEquipmentList] = useState<EquipmentDetail[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showStickerSheet, setShowStickerSheet] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState<{ [key: number]: boolean }>({});
  const [viewingCodesFor, setViewingCodesFor] = useState<EquipmentDetail | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [reportEmail, setReportEmail] = useState('');
  const [lastSavedInwardId, setLastSavedInwardId] = useState<number | null>(null);
  const [lastSavedSrfNo, setLastSavedSrfNo] = useState<string>('');
  
  const isFormReady = !isLoading && formData.srf_no !== 'Loading...';

  useEffect(() => { initializeForm(); }, []);

  const handleBackToPortal = () => navigate('/engineer');

  const initializeForm = () => {
    try {
      const srfNo = generateSRFNo();
      setFormData({ 
          srf_no: srfNo, 
          date: new Date().toISOString().split('T')[0], 
          customer_dc_date: new Date().toISOString().split('T')[0], 
          receiver: '', 
          customer_details: '',
      });
      setEquipmentList([{ nepl_id: `${srfNo}-1`, material_desc: '', make: '', model: '', range: '', serial_no: '', qty: 1, inspe_notes: '', calibration_by: 'In Lab', nextage_ref: '' }]);
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to initialize form.');
      setFormData((prev) => ({ ...prev, srf_no: 'Error!' }));
    }
  };
  
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
        const currentEquipment = updatedList[index];
        const existingPhotos = currentEquipment.photos || [];
        updatedList[index] = { ...currentEquipment, photos: [...existingPhotos, ...newFiles] };
        return updatedList;
      });
    }
  };

  const handleRemovePhoto = (eqIndex: number, photoIndex: number) => {
    setEquipmentList(currentList => {
      const updatedList = [...currentList];
      const currentEquipment = updatedList[eqIndex];
      const updatedPhotos = currentEquipment.photos?.filter((_, pIndex) => pIndex !== photoIndex);
      updatedList[eqIndex] = { ...currentEquipment, photos: updatedPhotos };
      return updatedList;
    });
  };

  const addEquipmentRow = () => {
    const newIndex = equipmentList.length + 1;
    const neplId = `${formData.srf_no}-${newIndex}`;
    setEquipmentList([...equipmentList, { nepl_id: neplId, material_desc: '', make: '', model: '', range: '', serial_no: '', qty: 1, inspe_notes: '', calibration_by: 'In Lab', nextage_ref: '' }]);
  };

  const removeEquipmentRow = (index: number) => {
    if (equipmentList.length > 1) {
      const reindexedList = equipmentList.filter((_, i) => i !== index).map((item, i) => ({ ...item, nepl_id: `${formData.srf_no}-${i + 1}` }));
      setEquipmentList(reindexedList);
    }
  };

  const generateCodesForEquipment = async (index: number) => {
    const equipment = equipmentList[index];
    if (!equipment || equipment.barcode || equipment.qr_code || loadingCodes[index] || !equipment.nepl_id || !equipment.material_desc || !equipment.make || !equipment.model) return;
    setLoadingCodes(prev => ({ ...prev, [index]: true }));
    try {
      const [barcode, qr_code] = await Promise.all([generateBarcode(equipment.nepl_id), generateQRCode(equipment)]);
      setEquipmentList(currentList => {
        const updatedList = [...currentList];
        if (updatedList[index]) {
            updatedList[index] = { ...updatedList[index], barcode, qr_code };
        }
        return updatedList;
      });
    } catch (error) {
      console.error("Code generation failed:", error);
    } finally {
      setLoadingCodes(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleRowBlur = (index: number) => { generateCodesForEquipment(index); };
  const viewEquipmentDetails = (index: number) => { setSelectedEquipment(equipmentList[index]); };
  const showMessage = (type: 'success' | 'error', text: string) => { setMessage({ type, text }); setTimeout(() => setMessage(null), 5000); };
  const isAnyOutsourced = equipmentList.some(eq => eq.calibration_by === 'Outsource');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (formData.srf_no === 'Loading...') {
        showMessage('error', 'SRF Number is not ready. Please wait.');
        setIsLoading(false);
        return;
    }

    try {
      if (!formData.receiver || !formData.customer_details) throw new Error('Please fill in all required basic information fields.');
      if (equipmentList.some(eq => !eq.material_desc || !eq.make || !eq.model)) throw new Error('Please fill in Material Desc, Make, and Model for all equipment.');

      const submissionData = new FormData();
      submissionData.append('srf_no', String(formData.srf_no));
      submissionData.append('date', formData.date);
      submissionData.append('customer_dc_date', formData.customer_dc_date);
      submissionData.append('receiver', formData.receiver);
      submissionData.append('customer_details', formData.customer_details);
      
      const equipmentDataForJson = equipmentList.map(({ photos, ...rest }) => ({ ...rest, qty: Number(rest.qty) }));
      submissionData.append('equipment_list', JSON.stringify(equipmentDataForJson));

      equipmentList.forEach((equipment, index) => {
        equipment.photos?.forEach(photoFile => {
          submissionData.append(`photos_${index}`, photoFile, photoFile.name);
        });
      });
      
      // --- FIX: Corrected endpoint path from ENDPOINTS.INWARDS to ENDPOINTS.STAFF.INWARDS ---
      const response = await api.post<InwardResponse>(ENDPOINTS.STAFF.INWARDS, submissionData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      showMessage('success', `Inward form SRF ${response.data.srf_no} saved successfully!`);
      setShowEmailModal(true);
      setLastSavedInwardId(response.data.inward_id);
      setLastSavedSrfNo(String(response.data.srf_no));
      initializeForm();

    } catch (error: unknown) {
        if (isSimpleAxiosError(error)) {
            const detail = error.response?.data?.detail;
            const errorMessage = Array.isArray(detail) ? detail[0].msg : detail || 'An error occurred while saving.';
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
      // --- FIX: Corrected and renamed endpoint path ---
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
      // --- FIX: Corrected and renamed endpoint path ---
      await api.post(ENDPOINTS.STAFF.INWARD_SEND_REPORT(lastSavedInwardId), { send_later: true });
      showMessage('success', `Report for SRF ${lastSavedSrfNo} is scheduled. Manage it in the Engineer Portal.`);
      setShowEmailModal(false);
    } catch (error: any) {
      showMessage('error', error.response?.data?.detail || 'Failed to schedule email.');
    }
  };

  const renderEmailModal = () => {
    if (!showEmailModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={() => setShowEmailModal(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4 p-8 relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowEmailModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><X size={24} /></button>
          <div className="flex items-center space-x-4 mb-4"><Mail className="text-blue-600" size={36} /><h2 className="text-2xl font-bold text-gray-800">What's Next?</h2></div>
          <p className="text-gray-600 mb-6">Inward SRF <strong>{lastSavedSrfNo}</strong> is saved. Choose an option to send the first inspection report.</p>
          <div className="space-y-6">
            <form onSubmit={handleSendEmail} className="p-4 border rounded-lg bg-gray-50">
              <label htmlFor="reportEmail" className="block text-sm font-medium text-gray-700 mb-2">Option 1: Send Immediately</label>
              <div className="flex gap-2">
                <input id="reportEmail" type="email" value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} required placeholder="Enter customer's email..." className="flex-grow px-4 py-2 border border-gray-300 rounded-lg" />
                <button type="submit" disabled={!reportEmail} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-bold"><Send size={18} /><span>Send Now</span></button>
              </div>
            </form>
            <div className="p-4 border rounded-lg bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">Option 2: Schedule for Later</label>
              <button type="button" onClick={handleSendLater} className="w-full flex items-center justify-center space-x-2 px-6 py-3 text-orange-700 bg-orange-100 border border-orange-300 rounded-lg hover:bg-orange-200 font-medium"><Clock size={20} /><span>Add to Scheduled Tasks (Send within 24 Hours)</span></button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100">
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div className="flex items-center space-x-4"><FileText className="h-8 w-8 text-blue-600" /><h1 className="text-3xl font-bold text-gray-900">Inward Form</h1></div>
        <button type="button" onClick={handleBackToPortal} className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold"><ArrowLeft size={20} /><span>Back to Portal</span></button>
      </div>

      {message && (<div className={`my-4 px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border' : 'bg-red-50 text-red-800 border'}`}>{message.text}</div>)}
      
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

        <div className="mb-8">
          <div className="mb-4"><h2 className="text-xl font-semibold text-gray-800">Equipment Details</h2></div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-3 border sticky left-0 z-20 bg-gray-100 w-12 text-center">#</th>
                  <th className="p-3 border w-40">NEPL ID</th>
                  <th className="p-3 border w-48">Material Desc *</th>
                  <th className="p-3 border w-40">Make *</th>
                  <th className="p-3 border w-40">Model *</th>
                  <th className="p-3 border w-32">Range</th>
                  <th className="p-3 border w-40">Serial No</th>
                  <th className="p-3 border w-20 text-center">Qty *</th>
                  <th className="p-3 border w-36">Calibration *</th>
                  {isAnyOutsourced && (<><th className="p-3 border w-40">Supplier</th><th className="p-3 border w-32">In DC</th><th className="p-3 border w-32">Out DC</th></>)}
                  <th className="p-3 border w-32">Nextage Ref</th>
                  <th className="p-3 border w-48">Insp. Notes</th>
                  <th className="p-3 border w-48">Photos</th>
                  <th className="p-3 border w-28">Codes</th>
                  <th className="p-3 border sticky right-0 z-20 bg-gray-100 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipmentList.map((equipment, index) => (
                  <tr key={index} className="hover:bg-gray-50 group">
                    <td className="p-2 border text-center sticky left-0 z-10 bg-white group-hover:bg-gray-50">{index + 1}</td>
                    <td className="p-2 border"><input type="text" value={equipment.nepl_id} disabled className="bg-gray-100 w-full text-center font-semibold px-2 py-1 rounded border" /></td>
                    <td className="p-2 border"><input type="text" value={equipment.material_desc} onBlur={() => handleRowBlur(index)} onChange={(e) => handleEquipmentChange(index, 'material_desc', e.target.value)} className="w-full px-2 py-1 border rounded" required /></td>
                    <td className="p-2 border"><input type="text" value={equipment.make} onBlur={() => handleRowBlur(index)} onChange={(e) => handleEquipmentChange(index, 'make', e.target.value)} className="w-full px-2 py-1 border rounded" required /></td>
                    <td className="p-2 border"><input type="text" value={equipment.model} onBlur={() => handleRowBlur(index)} onChange={(e) => handleEquipmentChange(index, 'model', e.target.value)} className="w-full px-2 py-1 border rounded" required /></td>
                    <td className="p-2 border"><input type="text" value={equipment.range || ''} onChange={(e) => handleEquipmentChange(index, 'range', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                    <td className="p-2 border"><input type="text" value={equipment.serial_no || ''} onChange={(e) => handleEquipmentChange(index, 'serial_no', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                    <td className="p-2 border text-center"><input type="number" value={equipment.qty} min={1} onChange={(e) => handleEquipmentChange(index, 'qty', parseInt(e.target.value) || 1)} className="w-full px-2 py-1 border rounded text-center" required /></td>
                    <td className="p-2 border"><select className="w-full px-2 py-1 border rounded" value={equipment.calibration_by} onChange={(e) => handleEquipmentChange(index, 'calibration_by', e.target.value)}><option value="In Lab">In Lab</option><option value="Outsource">Outsource</option><option value="Out Lab">Out Lab</option></select></td>
                    {equipment.calibration_by === 'Outsource' ? (<><td className="p-2 border"><input type="text" placeholder="Supplier" value={equipment.supplier || ''} onChange={(e) => handleEquipmentChange(index, 'supplier', e.target.value)} className="w-full px-2 py-1 border rounded" /></td><td className="p-2 border"><input type="text" placeholder="In DC" value={equipment.in_dc || ''} onChange={(e) => handleEquipmentChange(index, 'in_dc', e.target.value)} className="w-full px-2 py-1 border rounded" /></td><td className="p-2 border"><input type="text" placeholder="Out DC" value={equipment.out_dc || ''} onChange={(e) => handleEquipmentChange(index, 'out_dc', e.target.value)} className="w-full px-2 py-1 border rounded" /></td></>) : (isAnyOutsourced && <td colSpan={3} className="p-2 border bg-gray-50"></td>)}
                    <td className="p-2 border"><input type="text" value={equipment.nextage_ref || ''} onChange={(e) => handleEquipmentChange(index, 'nextage_ref', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                    <td className="p-2 border"><textarea rows={1} value={equipment.inspe_notes || ''} onChange={(e) => handleEquipmentChange(index, 'inspe_notes', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                    <td className="p-2 border align-top">
                      <div className="flex flex-col gap-2"><label htmlFor={`photo-upload-${index}`} className="flex items-center justify-center gap-2 w-full cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-1.5 rounded-md text-xs"><Camera size={14} /> Attach</label><input id={`photo-upload-${index}`} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handlePhotoChange(index, e)} />{equipment.photos && equipment.photos.length > 0 && (<div className="flex flex-col gap-1.5 mt-1">{equipment.photos.map((photo, photoIndex) => (<div key={photoIndex} className="flex items-center justify-between bg-gray-50 p-1 rounded text-xs"><span className="flex items-center gap-1.5 text-gray-600 truncate"><Paperclip size={12} /><span className="truncate" title={photo.name}>{photo.name}</span></span><button type="button" onClick={() => handleRemovePhoto(index, photoIndex)} className="text-red-500 hover:text-red-700 p-0.5 rounded-full"><X size={14} /></button></div>))}</div>)}</div>
                    </td>
                    <td className="p-2 border align-middle text-center">{loadingCodes[index] ? (<div className="flex justify-center items-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>) : equipment.barcode && equipment.qr_code ? (<button type="button" onClick={() => setViewingCodesFor(equipment)} className="bg-indigo-500 text-white px-3 py-1 rounded-md text-xs hover:bg-indigo-600 flex items-center justify-center w-full"><ScanLine size={14} className="mr-1" /> View</button>) : (<span className="text-gray-400 text-xs italic">Auto-gen</span>)}</td>
                    <td className="p-2 border sticky right-0 z-10 bg-white group-hover:bg-gray-50">
                        <div className="flex flex-col gap-1">
                            <button type="button" onClick={() => viewEquipmentDetails(index)} className="bg-blue-500 hover:bg-blue-600 text-white py-1 rounded text-xs flex items-center justify-center gap-1"><Eye size={14} />Details</button>
                            {equipmentList.length > 1 && (<button type="button" onClick={() => removeEquipmentRow(index)} className="bg-red-500 hover:bg-red-600 text-white py-1 rounded text-xs flex items-center justify-center gap-1"><Trash2 size={14} />Remove</button>)}
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end items-center space-x-3 mt-4">
            <button type="button" onClick={addEquipmentRow} className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold"><Plus size={20} /><span>Add Equipment</span></button>
            <button type="button" onClick={() => setShowStickerSheet(true)} className="flex items-center space-x-2 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 font-semibold"><Barcode size={20} /><span>Print Stickers</span></button>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t mt-8">
          <button
            type="submit"
            disabled={!isFormReady || isLoading}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            <span>{isLoading ? 'Saving...' : 'Save Inward Form'}</span>
          </button>
        </div>
      </form>

      {selectedEquipment && <EquipmentDetailsModal equipment={selectedEquipment} onClose={() => setSelectedEquipment(null)} />}
      {viewingCodesFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setViewingCodesFor(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md m-4 p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewingCodesFor(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"><X size={24} /></button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Codes for Equipment</h2>
            <p className="text-lg text-blue-600 font-semibold mb-6">{viewingCodesFor.nepl_id}</p>
            <div className="space-y-6">
              <div className="text-center"><h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Barcode</h3>{viewingCodesFor.barcode ? <div className="bg-white p-4 border rounded-md inline-block"><img src={viewingCodesFor.barcode} alt={`Barcode for ${viewingCodesFor.nepl_id}`} className="h-20" /></div> : <p className="text-gray-500">Not generated</p>}<p className="text-gray-700 mt-2 font-mono">{viewingCodesFor.nepl_id}</p></div>
              <div className="text-center"><h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">QR Code</h3>{viewingCodesFor.qr_code ? <div className="bg-white p-4 border rounded-md inline-block"><img src={viewingCodesFor.qr_code} alt={`QR Code for ${viewingCodesFor.nepl_id}`} className="h-40 w-40" /></div> : <p className="text-gray-500">Not generated</p>}</div>
            </div>
            <div className="mt-8 text-center"><button onClick={() => setViewingCodesFor(null)} className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-700">Close</button></div>
          </div>
        </div>
      )}
      {renderEmailModal()}
      {showStickerSheet && (
        <div className="fixed inset-0 z-50 bg-white p-6 overflow-auto print:overflow-visible print:p-0">
          <div className="flex justify-between items-center mb-6 print:hidden"><h2 className="text-2xl font-bold">Printable Sticker Sheet</h2><div className="space-x-2"><button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Print</button><button onClick={() => setShowStickerSheet(false)} className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded">Close</button></div></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 print:grid-cols-4">
            {equipmentList.map((item, index) => (
              <div key={index} className="border border-gray-400 rounded p-3 text-center text-xs break-inside-avoid print:break-inside-avoid">
                <div className="font-semibold mb-2 text-sm">{item.nepl_id}</div>
                {item.barcode && <img src={item.barcode} alt={`Barcode for ${item.nepl_id}`} className="mx-auto max-h-16 mb-2" />}
                {item.qr_code && <img src={item.qr_code} alt={`QR Code for ${item.nepl_id}`} className="mx-auto max-h-24" />}
                {!item.barcode && !item.qr_code && <p className="text-gray-500 ">Codes not generated</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};