import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { User as BaseUser, UserRole } from '../types'; 
import { api, ENDPOINTS } from '../api/config';
import { MasterStandardModule } from '../components/AdminComponents/MasterStandardModule';
import Header from '../components/Header';
import Footer from '../components/Footer';

import { 
  Shield, Power, PowerOff, UserPlus, Users, Info, Loader2,
  Settings, ChevronLeft, Ruler, AlertCircle, X, Search,
  LayoutDashboard, Menu,  Filter, Briefcase, Wrench, 
  Building2, Grid, AlignJustify,  Lock, CheckCircle2, 
  XCircle, ChevronDown, Activity, UserCog
} from 'lucide-react';

import { useSearchParams } from 'react-router-dom';

// --- Extended Types for UI ---
interface User extends BaseUser {
  customer_details?: string; 
}

interface Customer {
  customer_id: number;
  customer_details: string; 
  contact_person: string;
  phone: string;
  email: string;
  ship_to_address?: string;
  bill_to_address?: string;
}

type UserFilterTab = 'all' | 'admin' | 'engineer' | 'customer';

interface UsersResponse {
  users: User[];
}

interface InvitationResponse {
  message: string;
}

// --- SHARED UI COMPONENTS ---

const StatCard: React.FC<{ 
    icon: React.ReactNode; 
    label: string; 
    value: number; 
    description: string; 
    gradient: string; 
    bgGradient: string; 
}> = ({ icon, label, value, description, gradient, bgGradient }) => ( 
    <div className={`relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl group transition-all duration-300`}> 
        <div className={`absolute inset-0 bg-gradient-to-r ${bgGradient} opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl`} /> 
        <div className="relative z-10"> 
            <div className="flex items-start justify-between mb-6"> 
                <div className={`p-4 bg-gradient-to-r ${gradient} rounded-xl text-white shadow-lg`}>{icon}</div> 
                <div className="text-4xl font-bold text-gray-900 group-hover:text-gray-800 transition-colors">{value}</div> 
            </div> 
            <div> 
                <h3 className="text-xl font-semibold text-gray-900">{label}</h3> 
                <p className="text-gray-500 group-hover:text-gray-700 text-sm font-medium mt-1">{description}</p> 
            </div> 
        </div> 
    </div> 
);

const ActionButton: React.FC<{ 
    color: string; 
    label: string; 
    description: string; 
    icon: React.ReactNode; 
    onClick: () => void; 
}> = ({ color, label, description, icon, onClick }) => ( 
    <button onClick={onClick} className="relative group bg-white border border-gray-100 rounded-xl p-6 hover:shadow-lg text-left transition-all duration-300 hover:-translate-y-1"> 
        <div className={`inline-flex p-3 bg-gradient-to-r ${color} rounded-xl text-white mb-4 shadow-md`}>{icon}</div> 
        <h3 className="font-semibold text-lg text-gray-800">{label}</h3> 
        <p className="text-sm text-gray-500 mt-2">{description}</p> 
    </button> 
);

// --- INTERNAL COMPONENTS ---

// 1. New Company Modal
interface CompanyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

const CompanyEntryModal: React.FC<CompanyEntryModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [tempName, setTempName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onConfirm(tempName.trim());
      setTempName('');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="text-blue-600" size={20} />
            Enter New Company
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name (Customer Details)
            </label>
            <input 
              autoFocus
              type="text" 
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="e.g. Acme Industries Ltd."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              This will create a new customer record in the database upon invitation.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={!tempName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Confirm Name
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. Sidebar Component
interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  activeSection: string;
  setActiveSection: (val: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, activeSection, setActiveSection }) => {
  const [hoveredItem, setHoveredItem] = useState<{ label: string; top: number } | null>(null);

  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'invite-users', label: 'Invite User', icon: <UserPlus size={20} /> },
    { id: 'users', label: 'User Management', icon: <Users size={20} /> },
  ];

  const adminToolItems = [
    { id: 'master-standard', label: 'Master Standards', icon: <Ruler size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, label: string) => {
    if (isOpen) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItem({
      label,
      top: rect.top + (rect.height / 2)
    });
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  const renderNavButton = (item: { id: string; label: string; icon: React.ReactNode }) => {
    const isActive = activeSection === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveSection(item.id)}
        onMouseEnter={(e) => handleMouseEnter(e, item.label)}
        onMouseLeave={handleMouseLeave}
        className={`
          w-full flex items-center px-3 py-3 my-1 rounded-xl transition-all duration-200 group relative
          ${isOpen ? 'justify-start' : 'justify-center'} 
          ${isActive 
            ? 'bg-blue-600 text-white shadow-md shadow-blue-200/50' 
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
          }
        `}
      >
        <div className={`flex-shrink-0 transition-colors duration-200 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`}>
          {item.icon}
        </div>
        
        <span 
          className={`
            ml-3 text-sm font-medium whitespace-nowrap transition-all duration-300 origin-left
            ${isOpen ? 'opacity-100 w-auto translate-x-0' : 'opacity-0 w-0 -translate-x-4 overflow-hidden hidden'}
          `}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <>
      <aside 
        className={`
          relative bg-white border-r border-gray-200 flex flex-col h-[calc(100vh-4rem)]
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-64' : 'w-[4.5rem]'}
        `}
      >
        {/* Sidebar Toggle Header */}
        <div className={`h-14 flex items-center px-4 flex-shrink-0 bg-white border-b border-gray-50 ${isOpen ? 'justify-between' : 'justify-center'}`}>
           {isOpen && (
             <div className="font-extrabold text-gray-800 text-lg tracking-tight animate-fadeIn truncate">
                Admin<span className="text-blue-600">Portal</span>
             </div>
           )}

           <button 
              onClick={() => setIsOpen(!isOpen)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all border border-transparent hover:border-gray-100"
              title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
           </button>
        </div>

        {/* Sidebar Menu Items */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-200 flex flex-col">
          <div className="space-y-1">
            {mainNavItems.map(renderNavButton)}
          </div>

          <div className="my-6">
             {isOpen ? (
              <div className="px-3 mb-2 animate-fadeIn">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Configuration
                </span>
              </div>
            ) : (
              <div className="border-t border-gray-100 mx-2 mb-3" />
            )}
            
            <div className="space-y-1">
              {adminToolItems.map(renderNavButton)}
            </div>
          </div>
        </nav>
      </aside>

      {!isOpen && hoveredItem && (
        <div 
          className="fixed z-[150] px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap pointer-events-none animate-fadeIn"
          style={{ 
            left: '5.2rem', 
            top: hoveredItem.top,
            transform: 'translateY(-50%)' 
          }}
        >
          {hoveredItem.label}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </>
  );
};

// 3. User Table Row
const UserTableRow: React.FC<{
    user: User;
    updatingUserId: number | null;
    onToggleStatus: (userId: number, currentStatus: boolean) => void;
    isGroupInactive?: boolean; 
  }> = ({ user, updatingUserId, onToggleStatus, isGroupInactive }) => {
    const isActionBlocked = isGroupInactive && !user.is_active;

    return (
    <tr className={`hover:bg-blue-50/30 transition-colors border-b border-gray-50 last:border-b-0 ${!user.is_active ? 'bg-gray-50/40 text-gray-500' : ''}`}>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className={`font-semibold ${user.is_active ? 'text-gray-900' : 'text-gray-500'}`}>{user.full_name || user.username}</span>
          <span className="text-gray-400 text-xs">{user.email}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        {user.role === 'customer' && user.customer_details ? (
             <div className={`flex items-center text-sm ${user.is_active ? 'text-gray-600' : 'text-gray-400'}`}>
                 <Building2 size={14} className="mr-2 opacity-70"/>
                 {user.customer_details}
             </div>
        ) : (
            <span className="text-gray-400 text-xs italic">N/A</span>
        )}
      </td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize
          ${user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : ''}
          ${user.role === 'engineer' ? 'bg-orange-50 text-orange-700 border-orange-100' : ''}
          ${user.role === 'customer' ? 'bg-blue-50 text-blue-700 border-blue-100' : ''}
          ${!user.is_active ? 'opacity-60 grayscale' : ''}
        `}>
          {user.role}
        </span>
      </td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            user.is_active 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
              : 'bg-red-50 text-red-700 border-red-100'
          }`}
        >
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="relative inline-block group/tooltip">
            <button
            type="button"
            onClick={() => onToggleStatus(user.user_id, Boolean(user.is_active))}
            disabled={updatingUserId === user.user_id || isActionBlocked}
            className={`
                inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm
                ${isActionBlocked 
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : Boolean(user.is_active)
                    ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 border border-transparent'
                } disabled:opacity-70
            `}
            >
            {updatingUserId === user.user_id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
            ) : isActionBlocked ? (
                <Lock className="w-3 h-3" /> 
            ) : Boolean(user.is_active) ? (
                <PowerOff className="w-3 h-3" />
            ) : (
                <Power className="w-3 h-3" />
            )}
            {Boolean(user.is_active) ? 'Deactivate' : 'Activate'}
            </button>
            {isActionBlocked && (
                <div className="absolute bottom-full right-0 mb-2 w-max px-2 py-1 bg-gray-800 text-white text-[10px] rounded shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
                    Activate Company First
                    <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                </div>
            )}
        </div>
      </td>
    </tr>
  );
};

// 4. Company Group Header
const CompanyGroupHeader: React.FC<{
    companyName: string;
    users: User[];
    onBatchUpdate: (companyName: string, newStatus: boolean) => void;
    isUpdating: boolean;
}> = ({ companyName, users, onBatchUpdate, isUpdating }) => {
    const hasActiveUsers = users.some(u => u.is_active);
    const targetStatus = !hasActiveUsers; 

    const handleBatchClick = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        const action = targetStatus ? "ACTIVATE" : "DEACTIVATE";
        if (window.confirm(`Are you sure you want to ${action} all ${users.length} users in ${companyName}?`)) {
            onBatchUpdate(companyName, targetStatus);
        }
    };

    if (companyName === 'Unassigned / Independent') {
        return (
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-gray-200 p-2 rounded-lg text-gray-500"><Users size={18} /></div>
                    <div><h4 className="font-bold text-gray-800 text-sm">{companyName}</h4><span className="text-xs text-gray-500">{users.length} user(s)</span></div>
                </div>
            </div>
        );
    }

    return (
        <div className={`px-6 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3 transition-colors ${hasActiveUsers ? 'bg-blue-50/30' : 'bg-red-50/30'}`}>
            <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl shadow-sm ${hasActiveUsers ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-500'}`}>
                    <Building2 size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        {companyName}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold border ${hasActiveUsers ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                            {hasActiveUsers ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            {hasActiveUsers ? 'Active' : 'Inactive'}
                        </span>
                    </h4>
                    <span className="text-xs text-gray-500 font-medium">{users.length} associated account(s)</span>
                </div>
            </div>

            <button
                onClick={handleBatchClick}
                disabled={isUpdating}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm
                    ${targetStatus 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-emerald-200' 
                        : 'bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                {isUpdating ? (
                    <Loader2 size={14} className="animate-spin" />
                ) : targetStatus ? (
                    <Power size={14} />
                ) : (
                    <PowerOff size={14} />
                )}
                {targetStatus ? 'Activate Company' : 'Deactivate Company'}
            </button>
        </div>
    );
};

// 5. User Management Component
const UserManagementSystem: React.FC<{
  users: User[];
  updatingUserId: number | null;
  onToggleStatus: (userId: number, currentStatus: boolean) => void;
  onRefreshData: () => void; 
}> = ({ users, updatingUserId, onToggleStatus, onRefreshData }) => {
  const [activeFilter, setActiveFilter] = useState<UserFilterTab>('all');
  const [groupByCompany, setGroupByCompany] = useState(false); 
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingCompany, setUpdatingCompany] = useState<string | null>(null);

  useEffect(() => {
    setSearchTerm('');
  }, [activeFilter]);

  const handleBatchUpdate = async (companyName: string, newStatus: boolean) => {
      setUpdatingCompany(companyName);
      try {
          await api.post('/users/batch-status-by-customer', {
              customer_details: companyName,
              is_active: newStatus
          });
          onRefreshData(); 
      } catch (error) {
          console.error("Batch update failed", error);
          alert("Failed to update company users.");
      } finally {
          setUpdatingCompany(null);
      }
  };

  const filteredUsers = users.filter((user) => {
    if (activeFilter !== 'all' && user.role !== activeFilter) return false;
    if (searchTerm.trim() !== '') {
        const lowerTerm = searchTerm.toLowerCase();
        const matchesName = (user.full_name || user.username).toLowerCase().includes(lowerTerm);
        const matchesEmail = user.email.toLowerCase().includes(lowerTerm);
        const matchesCompany = (user.customer_details || '').toLowerCase().includes(lowerTerm);
        return matchesName || matchesEmail || matchesCompany;
    }
    return true;
  });

  const groupedCustomers = activeFilter === 'customer' && groupByCompany
    ? filteredUsers.reduce((groups, user) => {
        const company = user.customer_details || 'Unassigned / Independent';
        if (!groups[company]) {
          groups[company] = [];
        }
        groups[company].push(user);
        return groups;
      }, {} as Record<string, User[]>)
    : null;

  const TabButton = ({ id, label, icon, count }: { id: UserFilterTab; label: string; icon: React.ReactNode, count: number }) => (
    <button
      onClick={() => setActiveFilter(id)}
      className={`
        flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap
        ${activeFilter === id 
          ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }
      `}
    >
      {icon}
      {label}
      <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${activeFilter === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
        {count}
      </span>
    </button>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="border-b border-gray-200 bg-white">
         <div className="p-6 pb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Users size={24} className="text-blue-600"/>
                User Directory
            </h3>
            <p className="text-gray-500 text-sm mt-1">Manage system access for staff and clients.</p>
         </div>
         
         <div className="flex overflow-x-auto scrollbar-hide px-2">
            <TabButton id="all" label="All Users" icon={<Users size={16}/>} count={users.length} />
            <TabButton id="admin" label="Administrators" icon={<Shield size={16}/>} count={users.filter(u => u.role === 'admin').length} />
            <TabButton id="engineer" label="Engineers" icon={<Wrench size={16}/>} count={users.filter(u => u.role === 'engineer').length} />
            <TabButton id="customer" label="Customers" icon={<Briefcase size={16}/>} count={users.filter(u => u.role === 'customer').length} />
         </div>
      </div>

      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Search size={16} />
                </div>
                <input 
                    type="text"
                    placeholder={activeFilter === 'customer' ? "Search Company or User..." : "Search Users..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                />
            </div>
            <div className="relative hidden sm:block">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Filter size={16} />
                </div>
                <select
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value as UserFilterTab)}
                    className="pl-10 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none cursor-pointer shadow-sm hover:border-gray-400 transition-colors"
                >
                    <option value="all">All Roles</option>
                    <option value="admin">Administrators</option>
                    <option value="engineer">Engineers</option>
                    <option value="customer">Customers</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-500">
                    <ChevronDown size={14} />
                </div>
            </div>
        </div>

        {activeFilter === 'customer' && (
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:inline">
                    {groupByCompany ? 'Grouped View' : 'List View'}
                </span>
                <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                    <button 
                        onClick={() => setGroupByCompany(false)} 
                        className={`p-1.5 rounded-md transition-all ${!groupByCompany ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} 
                        title="List View"
                    >
                        <AlignJustify size={18} />
                    </button>
                    <button 
                        onClick={() => setGroupByCompany(true)} 
                        className={`p-1.5 rounded-md transition-all ${groupByCompany ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} 
                        title="Group by Customer Details"
                    >
                        <Grid size={18} />
                    </button>
                </div>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-white min-h-[400px]">
        {groupedCustomers ? (
            <div className="p-6 space-y-6">
                {Object.entries(groupedCustomers).map(([companyName, companyUsers], index) => {
                    const isCompanyInactive = !companyUsers.some(u => u.is_active);
                    return (
                        <div key={index} className={`border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${isCompanyInactive ? 'border-gray-200 bg-gray-50' : 'border-blue-100 bg-white'}`}>
                            <CompanyGroupHeader 
                                companyName={companyName} 
                                users={companyUsers}
                                onBatchUpdate={handleBatchUpdate}
                                isUpdating={updatingCompany === companyName}
                            />
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50/50 text-gray-400 border-b border-gray-100 uppercase font-semibold text-[10px] tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3">User</th>
                                            <th className="px-6 py-3">Company Details</th>
                                            <th className="px-6 py-3">Role</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {companyUsers.map(u => (
                                            <UserTableRow 
                                                key={u.user_id} 
                                                user={u} 
                                                updatingUserId={updatingUserId} 
                                                onToggleStatus={onToggleStatus}
                                                isGroupInactive={isCompanyInactive && companyName !== 'Unassigned / Independent'} 
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">User Profile</th>
                    <th className="px-6 py-4">Company / Details</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                        <UserTableRow 
                            key={u.user_id} 
                            user={u} 
                            updatingUserId={updatingUserId} 
                            onToggleStatus={onToggleStatus} 
                        />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <Filter size={24} className="text-gray-400 mb-2" />
                          <p className="font-medium">No users found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
        )}
      </div>
    </div>
  );
};

// 6. Invite Users Section 
const InviteUsersSection: React.FC<{ existingCustomers: Customer[] }> = ({ existingCustomers }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('customer');
    const [invitedName, setInvitedName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [shipToAddress, setShipToAddress] = useState('');
    const [billToAddress, setBillToAddress] = useState('');
    const [sameAsShip, setSameAsShip] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isCompanyModalOpen, setCompanyModalOpen] = useState(false);
    const [isCustomCompany, setIsCustomCompany] = useState(false);
    const isCustomerRole = role === 'customer';

    const handleSameAsShipChange = (checked: boolean) => {
        setSameAsShip(checked);
        if (checked) {
          setBillToAddress(shipToAddress);
        }
      };
    
      const handleCompanySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
          const val = e.target.value;
          if (val === '__NEW_COMPANY_TRIGGER__') {
              setCompanyModalOpen(true);
              setCompanyName('');
              setShipToAddress('');
              setBillToAddress('');
          } else {
              setCompanyName(val);
              setIsCustomCompany(false);
              const selectedCustomer = existingCustomers.find(c => c.customer_details === val);
              if (selectedCustomer) {
                  setShipToAddress(selectedCustomer.ship_to_address || '');
                  setBillToAddress(selectedCustomer.bill_to_address || selectedCustomer.ship_to_address || '');
              }
          }
      };
  
      const handleNewCompanyConfirm = (name: string) => {
          setCompanyName(name);
          setIsCustomCompany(true);
          setCompanyModalOpen(false);
          setShipToAddress('');
          setBillToAddress('');
      };
  
      const handleResetCompany = () => {
          setCompanyName('');
          setIsCustomCompany(false);
          setShipToAddress('');
          setBillToAddress('');
      };
    
      const handleInvite = async (e: FormEvent) => {
        e.preventDefault();
        setInviteMessage(null);
        let payload: any = { email, role };
        setIsInviting(true);
        try {
            if (isCustomerRole) {
                 payload = { 
                     ...payload, 
                     company_name: companyName.trim(), 
                     ship_to_address: shipToAddress.trim(), 
                     bill_to_address: billToAddress.trim(), 
                     invited_name: invitedName.trim(), 
                     phone_number: phoneNumber.trim() 
                  };
            } else {
                 payload = { ...payload, invited_name: invitedName.trim() };
            }
            const response = await api.post<InvitationResponse>(ENDPOINTS.INVITATIONS.SEND, payload);
            setInviteMessage({ type: 'success', text: response.data.message || `Invitation sent successfully to ${email}!` });
            setEmail(''); setRole('customer'); setInvitedName(''); setCompanyName(''); setShipToAddress(''); setBillToAddress(''); setSameAsShip(false); setPhoneNumber(''); setIsCustomCompany(false);
        } catch (error: any) {
            setInviteMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to send invitation.' });
        } finally {
            setIsInviting(false);
        }
      };

    return (
        <div className="max-w-3xl mx-auto p-8 bg-white border border-gray-100 rounded-2xl shadow-lg">
          <CompanyEntryModal isOpen={isCompanyModalOpen} onClose={() => setCompanyModalOpen(false)} onConfirm={handleNewCompanyConfirm} />
          <h2 className="text-2xl font-bold text-gray-800 flex items-center mb-6">
            <div className="p-2 bg-blue-100 rounded-lg mr-3"><UserPlus className="w-6 h-6 text-blue-600" /></div>
            Invite New System User
          </h2>
          <form onSubmit={handleInvite} className="space-y-5">
            {inviteMessage && <div className={`p-4 rounded-xl text-sm font-medium flex items-center ${inviteMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}><Info size={16} className="mr-2" />{inviteMessage.text}</div>}
            <div className="grid grid-cols-1 gap-5">
                <div>
                  <label htmlFor="role" className="block text-sm font-semibold text-gray-700 mb-1">Assign Role</label>
                  <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} required disabled={isInviting} className="w-full border border-gray-300 rounded-xl shadow-sm px-4 py-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
                    <option value="customer">Customer</option>
                    <option value="engineer">Engineer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {!isCustomerRole && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label><input type="text" value={invitedName} onChange={(e) => setInvitedName(e.target.value)} required={!isCustomerRole} disabled={isInviting} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!isCustomerRole} disabled={isInviting} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all" /></div>
                  </div>
                )}
                {isCustomerRole && (
                  <>
                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Company Details</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                            {isCustomCompany ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 font-medium">{companyName}</div>
                                    <button type="button" onClick={handleResetCompany} className="px-3 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Change</button>
                                </div>
                            ) : (
                                <div className="relative">
                                  <select value={companyName} onChange={handleCompanySelectChange} required={isCustomerRole} disabled={isInviting} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all appearance-none bg-white">
                                      <option value="" disabled>Select an existing company...</option>
                                      <option value="__NEW_COMPANY_TRIGGER__" className="font-bold text-blue-600 bg-blue-50">+ Add New Company</option>
                                      <option disabled>────────────────────</option>
                                      {existingCustomers.map((c, idx) => (<option key={idx} value={c.customer_details}>{c.customer_details}</option>))}
                                  </select>
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500"><ChevronLeft size={16} className="-rotate-90" /></div>
                                </div>
                            )}
                            <p className="text-xs text-gray-400 mt-1">Select existing or add new to create customer entry.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Ship To Address</label><textarea rows={3} value={shipToAddress} onChange={(e) => {setShipToAddress(e.target.value); if(sameAsShip) setBillToAddress(e.target.value);}} required={isCustomerRole} disabled={isInviting} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all resize-none" /></div>
                            <div><div className="flex justify-between items-center mb-1"><label className="block text-sm font-medium text-gray-700">Bill To Address</label><label className="text-xs flex items-center cursor-pointer text-gray-600"><input type="checkbox" checked={sameAsShip} onChange={(e) => handleSameAsShipChange(e.target.checked)} className="mr-1 rounded text-blue-600 focus:ring-blue-500" /> Same as Ship</label></div><textarea rows={3} value={billToAddress} onChange={(e) => setBillToAddress(e.target.value)} required={isCustomerRole} disabled={isInviting || sameAsShip} className={`w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all resize-none ${sameAsShip ? 'bg-gray-100 text-gray-500' : ''}`} /></div>
                        </div>
                    </div>
                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Contact Person</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label><input type="text" value={invitedName} onChange={(e) => setInvitedName(e.target.value)} required={isCustomerRole} disabled={isInviting} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all" /></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label><input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required={isCustomerRole} disabled={isInviting} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all" /></div>
                        </div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={isCustomerRole} disabled={isInviting} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all" /></div>
                    </div>
                  </>
                )}
            </div>
            <button type="submit" disabled={isInviting} className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed">
              {isInviting ? <Loader2 className="animate-spin mr-2" size={20} /> : <UserPlus className="mr-2" size={20} />}
              {isInviting ? 'Sending Invitation...' : 'Send Invitation'}
            </button>
          </form>
        </div>
      );
};

// --- NEW DASHBOARD HOME VIEW ---

const AdminDashboardHome: React.FC<{ users: User[], onNavigate: (section: string) => void }> = ({ users, onNavigate }) => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.is_active).length;
    const inactiveUsers = totalUsers - activeUsers;
    const adminCount = users.filter(u => u.role === 'admin').length;

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header Area */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 flex items-center gap-3">
                        <Shield className="w-10 h-10 text-blue-600" />
                        Admin Portal
                    </h1>
                    <p className="text-lg text-gray-500 mt-2">System overview and management controls.</p>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <StatCard 
                    icon={<Users className="w-10 h-10" />} 
                    label="Total Users" 
                    value={totalUsers} 
                    description={`${adminCount} Administrator(s)`}
                    gradient="from-blue-500 to-indigo-600"
                    bgGradient="from-blue-50 to-indigo-50"
                />
                 <StatCard 
                    icon={<Activity className="w-10 h-10" />} 
                    label="Active Accounts" 
                    value={activeUsers} 
                    description="Currently enabled"
                    gradient="from-emerald-500 to-green-600"
                    bgGradient="from-emerald-50 to-green-50"
                />
                 <StatCard 
                    icon={<PowerOff className="w-10 h-10" />} 
                    label="Inactive Accounts" 
                    value={inactiveUsers} 
                    description="Disabled or suspended"
                    gradient="from-orange-500 to-red-600"
                    bgGradient="from-orange-50 to-red-50"
                />
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-8 py-6 bg-gradient-to-r from-gray-900 to-gray-800">
                    <h2 className="text-2xl font-bold text-white">Administrative Actions</h2>
                    <p className="text-gray-400 mt-1">Common tasks and configurations</p>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ActionButton 
                        color="from-blue-500 to-cyan-500" 
                        label="Invite New User" 
                        description="Send email invitations to staff or customers." 
                        icon={<UserPlus className="h-8 w-8" />} 
                        onClick={() => onNavigate('invite-users')} 
                    />
                    <ActionButton 
                        color="from-purple-500 to-violet-500" 
                        label="Manage Users" 
                        description="View directory, toggle access, or update roles." 
                        icon={<UserCog className="h-8 w-8" />} 
                        onClick={() => onNavigate('users')} 
                    />
                     <ActionButton 
                        color="from-pink-500 to-rose-500" 
                        label="Master Standards" 
                        description="Configure calibration standards and references." 
                        icon={<Ruler className="h-8 w-8" />} 
                        onClick={() => onNavigate('master-standard')} 
                    />
                </div>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD COMPONENT ---
const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  
  // --- Updated: State synced with URL search params
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get('section') || 'dashboard';
  const [activeSection, setActiveSection] = useState<string>(initialSection);
  
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // --- Updated: Function to handle navigation
  const handleNavigate = (section: string) => {
    setActiveSection(section);
    setSearchParams({ section });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const usersRes = await api.get<UsersResponse>(ENDPOINTS.USERS.ALL_USERS);
      setUsers(usersRes.data.users);
      const customersRes = await api.get<Customer[]>(ENDPOINTS.PORTAL.CUSTOMERS_DROPDOWN);
      setCustomers(customersRes.data);
    } catch (e: unknown) {
      console.error("Error fetching admin data:", e);
      if (e && typeof e === 'object' && 'isAxiosError' in e) {
        const axiosError = e as any;
        if (axiosError.response?.status !== 401) {
          setError(axiosError.response?.data?.detail || 'Failed to fetch admin data.');
        }
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'dashboard' || activeSection === 'users' || activeSection === 'invite-users') {
      fetchData();
    }
  }, [fetchData, activeSection]);

  const handleToggleStatus = useCallback(async (userId: number, currentStatus: boolean) => {
      setStatusMessage(null);
      setUpdatingUserId(userId);
      try {
        const response = await api.patch<User>(ENDPOINTS.USERS.UPDATE_STATUS(userId), { is_active: !currentStatus });
        const nextStatus = response.data.is_active ?? !currentStatus;
        setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, is_active: nextStatus } : u));
        setStatusMessage({ type: 'success', text: `${response.data.full_name || 'User'} is now ${nextStatus ? 'Active' : 'Inactive'}.` });
      } catch (e: unknown) {
        setStatusMessage({ type: 'error', text: 'Failed to update user status.' });
      } finally {
        setUpdatingUserId(null);
      }
  }, []);

  const handleLogout = () => {
    if (logout) logout();
  };

  const userName = user?.full_name || user?.username || 'User';
  const userRole = user?.role || 'Admin';

  if (loading && activeSection === 'dashboard') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fc] font-sans text-gray-900">
      
      {/* 
         HEADER CONTAINER
      */}
      <div className="sticky top-0 z-[100] w-full bg-white border-b border-gray-200 shadow-sm">
         <Header username={userName} role={userRole} onLogout={handleLogout} />
      </div>

      {/* 
         MAIN LAYOUT
      */}
      <div className="flex flex-1 w-full relative z-0">
        
        {/* SIDEBAR CONTAINER */}
        <div className="flex-shrink-0 relative z-40 h-[calc(100vh-4rem)]">
             <div className="sticky top-0 h-full bg-white border-r border-gray-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                <Sidebar 
                    isOpen={isSidebarOpen} 
                    setIsOpen={setSidebarOpen} 
                    activeSection={activeSection} 
                    setActiveSection={handleNavigate} 
                />
             </div>
        </div>

        {/* CONTENT AREA */}
        <main className="flex-1 flex flex-col min-w-0 z-0 bg-gradient-to-br from-gray-50 via-white to-blue-50">
            <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
              {error && (<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700 animate-fadeIn"><AlertCircle className="w-5 h-5 mr-2" /><span>{error}</span></div>)}

              {/* --- Dashboard Home Section --- */}
              {activeSection === 'dashboard' && (
                <AdminDashboardHome users={users} onNavigate={handleNavigate} />
              )}

              {/* --- Invite Users Section --- */}
              {activeSection === 'invite-users' && (
                <div className="animate-fadeIn">
                   <InviteUsersSection existingCustomers={customers} />
                </div>
              )}

              {/* --- User Management Section --- */}
              {activeSection === 'users' && (
                <div className="animate-fadeIn h-full flex flex-col">
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold text-gray-900">User Management</h2>
                    <p className="text-gray-500 mt-1">View and manage all registered system users.</p>
                  </div>
                  <div className="flex-1 min-h-0">
                    {statusMessage && (
                        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center shadow-sm ${statusMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        <Info size={16} className="mr-2"/>{statusMessage.text}
                        </div>
                    )}
                    <UserManagementSystem 
                        users={users} 
                        updatingUserId={updatingUserId} 
                        onToggleStatus={handleToggleStatus}
                        onRefreshData={fetchData} 
                    />
                  </div>
                </div>
              )}

              {activeSection === 'master-standard' && <div className="animate-slideUp"><MasterStandardModule /></div>}

              {activeSection === 'settings' && (
                <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400 animate-fadeIn">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6"><Settings size={40} className="text-gray-400" /></div>
                  <h2 className="text-2xl font-semibold text-gray-300">Settings Configuration</h2>
                  <p className="text-gray-500 mt-2">Global system settings functionality is coming soon.</p>
                </div>
              )}
            </div>
        </main>
      </div>

      <footer className="w-full bg-white border-t border-gray-200 z-40 mt-auto">
          <Footer />
      </footer>

    </div>
  );
};

export default AdminDashboard;