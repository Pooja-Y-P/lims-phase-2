import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ENDPOINTS } from '../api/config';
import { Loader2, AlertTriangle, FileText, ChevronRight, ArrowLeft } from 'lucide-react';


interface InwardSummary {
  inward_id: number;
  srf_id: number | null; 
  srf_no: string;
  date: string;
  customer_details: string;
  status: 'created' | 'reviewed' | 'approved_by_customer' | 'rejected_by_customer' | 'inward_completed';
}

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  if (!token) return { headers: {} };
  return { headers: { Authorization: `Bearer ${token}` } };
};


interface SimpleAxiosError {
  isAxiosError: true;
  response?: { data?: any; status?: number; };
  message: string;
}
function isSimpleAxiosError(error: unknown): error is SimpleAxiosError {
  return typeof error === 'object' && error !== null && (error as any).isAxiosError === true;
}

const EnhancedSrfManagement: React.FC = () => {
  const [inwards, setInwards] = useState<InwardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInwards = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<InwardSummary[]>(ENDPOINTS.INWARDS, getAuthHeader());
        
        const filteredInwards = response.data.filter(inward => 
            inward.status === 'created' || inward.status === 'reviewed'
        );
        setInwards(filteredInwards);
      } catch (err: unknown) {
        if (isSimpleAxiosError(err)) {
          setError(err.response?.data?.detail || err.message);
        } else {
          setError('An unknown error occurred while fetching data.');
        }
        console.error("Failed to fetch inwards:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInwards();
  }, []);
  
    const handleOpenSrfForm = (inwardId: number) => {
   
    navigate(`/engineer/create-srf/${inwardId}`);
  };

  const handleBackToPortal = () => {
    navigate('/engineer'); 
  };

  
  const getStatusBadge = (status: InwardSummary['status']) => {
    const statusStyles: { [key: string]: string } = {
      created: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      reviewed: 'bg-blue-100 text-blue-800 border-blue-300',
      approved_by_customer: 'bg-green-100 text-green-800 border-green-300',
      inward_completed: 'bg-green-100 text-green-800 border-green-300',
      rejected_by_customer: 'bg-red-100 text-red-800 border-red-300',
    };
    const style = statusStyles[status] || 'bg-gray-100 text-gray-800 border-gray-300';
    return (
      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${style}`}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };
  
  const pendingSrfs = inwards.filter(inv => inv.status === 'created');
  const reviewedSrfs = inwards.filter(inv => inv.status === 'reviewed');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="text-lg">Loading SRF Entries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 max-w-2xl mx-auto my-8">
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
          <div>
            <p className="font-bold text-red-800">Failed to load data</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100">
      {/* MODIFIED HEADER SECTION */}
      <div className="flex items-center justify-between border-b pb-4 mb-8">
        <div className="flex items-center space-x-4">
            <FileText className="h-8 w-8 text-green-600" />
            <div>
                <h1 className="text-3xl font-bold text-gray-900">SRF Management</h1>
                <p className="text-gray-600 mt-1">Review pending SRFs and open reviewed forms for processing.</p>
            </div>
        </div>
        <button
          type="button"
          onClick={handleBackToPortal}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Portal</span>
        </button>
      </div>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Pending SRFs for Review</h2>
        {pendingSrfs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingSrfs.map((inward) => (
              <div key={inward.inward_id} className="bg-gray-50 border border-gray-200 rounded-lg p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-lg text-blue-700">{inward.srf_no}</span>
                    {getStatusBadge(inward.status)}
                  </div>
                  <p className="text-sm text-gray-700 font-medium truncate" title={inward.customer_details}>{inward.customer_details}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Created on: {new Date(inward.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                  This SRF needs to be reviewed by an engineer.
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 px-6 bg-gray-50 border-2 border-dashed rounded-lg">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No Pending SRFs</h3>
              <p className="mt-1 text-sm text-gray-500">All new inwards have been reviewed.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">Reviewed & Ready for Processing</h2>
        {reviewedSrfs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviewedSrfs.map((inward) => (
              <div key={inward.inward_id} className="bg-white border rounded-lg shadow-sm p-5 flex flex-col justify-between hover:shadow-lg transition-shadow">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-lg text-blue-700">{inward.srf_no}</span>
                    {getStatusBadge(inward.status)}
                  </div>
                  <p className="text-sm text-gray-700 font-medium truncate" title={inward.customer_details}>{inward.customer_details}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Created on: {new Date(inward.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <button
                    onClick={() => handleOpenSrfForm(inward.inward_id)}
                    className="w-full flex items-center justify-center bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Open SRF Form
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 px-6 bg-gray-50 border-2 border-dashed rounded-lg">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No Reviewed SRFs</h3>
              <p className="mt-1 text-sm text-gray-500">There are no SRFs ready for processing.</p>
          </div>
        )}
      </section>
    </div>
  );
};

// FIX 2: Added a default export
export default EnhancedSrfManagement;