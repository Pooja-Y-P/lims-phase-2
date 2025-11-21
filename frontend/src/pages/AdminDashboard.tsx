import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider'; 
import { User, UserRole } from '../types'; 
import { api, ENDPOINTS } from '../api/config'; 
import { Shield, Power, PowerOff, UserPlus, Users, Info, Loader2, MapPin, Receipt } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

type AdminViewTab = 'Overview' | 'Invite Users' | 'Manage Users';

interface UsersResponse {
  users: User[];
}

interface InvitationResponse {
  message: string;
}

// ✅ User management table moved above AdminDashboard
const UserManagementTable: React.FC<{
  users: User[];
  updatingUserId: number | null;
  onToggleStatus: (userId: number, currentStatus: boolean) => void;
}> = ({ users, updatingUserId, onToggleStatus }) => (
  <div className="border border-gray-200 rounded-lg overflow-hidden">
    <div className="p-4 bg-gray-50 border-b">
      <h3 className="text-xl font-semibold text-gray-700">System Users ({users.length})</h3>
    </div>
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-blue-50 text-gray-600 uppercase tracking-wider">
          <th className="p-3 font-bold text-left">Full Name</th>
          <th className="p-3 font-bold text-left">Email</th>
          <th className="p-3 font-bold text-left">Role</th>
          <th className="p-3 font-bold text-left">Status</th>
          <th className="p-3 font-bold text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.user_id} className="border-b last:border-b-0 hover:bg-gray-100 transition-colors">
            <td className="p-3 text-gray-800">{u.full_name || u.username}</td>
            <td className="p-3 text-gray-600">{u.email}</td>
            <td className="p-3 capitalize text-blue-600 font-medium">{u.role}</td>
            <td className="p-3">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {u.is_active ? <Power className="w-3 h-3 mr-1" /> : <PowerOff className="w-3 h-3 mr-1" />}
                {u.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td className="p-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onToggleStatus(u.user_id, Boolean(u.is_active))}
                  disabled={updatingUserId === u.user_id}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    Boolean(u.is_active)
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  } disabled:opacity-70 disabled:cursor-not-allowed`}
                >
                  {updatingUserId === u.user_id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : Boolean(u.is_active) ? (
                    <PowerOff className="w-3 h-3" />
                  ) : (
                    <Power className="w-3 h-3" />
                  )}
                  {Boolean(u.is_active) ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth(); 
  const [activeTab, setActiveTab] = useState<AdminViewTab>('Overview');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<UsersResponse>(ENDPOINTS.USERS.ALL_USERS);
      setUsers(response.data.users);
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
    fetchData();
  }, [fetchData]);

  const handleToggleStatus = useCallback(
    async (userId: number, currentStatus: boolean) => {
      setStatusMessage(null);
      setUpdatingUserId(userId);
      try {
        const response = await api.patch<User>(ENDPOINTS.USERS.UPDATE_STATUS(userId), {
          is_active: !currentStatus,
        });
        const nextStatus = response.data.is_active ?? !currentStatus;
        setUsers((prev) =>
          prev.map((u) =>
            u.user_id === userId ? { ...u, is_active: nextStatus } : u
          )
        );
        const displayName = response.data.full_name || response.data.username;
        setStatusMessage({
          type: 'success',
          text: `${displayName} is now ${nextStatus ? 'Active' : 'Inactive'}.`,
        });
      } catch (e: unknown) {
        console.error('Failed to update user status:', e);
        if (e && typeof e === 'object' && 'isAxiosError' in e) {
          const axiosError = e as any;
          setStatusMessage({
            type: 'error',
            text: axiosError.response?.data?.detail || 'Failed to update user status.',
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: 'An unknown error occurred while updating user status.',
          });
        }
      } finally {
        setUpdatingUserId(null);
      }
    },
    []
  );

  const handleLogout = () => {
    if (logout) logout();
  };

  const headerProps = {
    username: user?.full_name || user?.username || 'Guest',
    role: user?.role,
    onLogout: handleLogout,
  };
  
  const renderLoadingOrError = (content: React.ReactNode) => (
    <div className="min-h-screen flex flex-col justify-between bg-gray-50">
      <Header {...headerProps} />
      <div className="flex-grow p-8 text-center text-xl">{content}</div>
      <Footer />
    </div>
  );

  if (loading) return renderLoadingOrError("Loading Admin Data...");
  if (!user) return renderLoadingOrError("Redirecting...");
  if (error) return renderLoadingOrError(<div className="text-red-600 border border-red-300 bg-red-50 p-4 rounded">{error}</div>);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header {...headerProps} />
      <div className="flex-grow bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center mb-1">
              <Shield className="w-8 h-8 mr-3 text-blue-600" />
              Admin Control Panel
            </h1>
            <p className="text-gray-600 font-medium ml-11">
              Welcome, {user?.full_name || user?.username} ({user?.role})
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-xl overflow-hidden p-6">
            <nav className="flex border-b border-gray-200 mb-6">
              <TabButton title="Overview" activeTab={activeTab} setActiveTab={setActiveTab} />
              <TabButton title="Invite Users" activeTab={activeTab} setActiveTab={setActiveTab} />
              <TabButton title="Manage Users" activeTab={activeTab} setActiveTab={setActiveTab} />
            </nav>

            <div>
              {activeTab === 'Overview' && <OverviewSection users={users} />}
              {activeTab === 'Invite Users' && <InviteUsersSection />}
              {activeTab === 'Manage Users' && (
                <div className="space-y-4">
                  {statusMessage && (
                    <div
                      className={`px-4 py-3 rounded-md text-sm font-medium ${
                        statusMessage.type === 'success'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {statusMessage.text}
                    </div>
                  )}
                  <UserManagementTable
                    users={users}
                    updatingUserId={updatingUserId}
                    onToggleStatus={handleToggleStatus}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

const TabButton: React.FC<{ 
  title: AdminViewTab; 
  activeTab: AdminViewTab; 
  setActiveTab: (tab: AdminViewTab) => void;
}> = ({ title, activeTab, setActiveTab }) => (
  <button
    onClick={() => setActiveTab(title)}
    className={`px-6 py-3 text-lg font-semibold -mb-px transition-colors ${
      activeTab === title ? 'border-b-4 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'
    }`}
  >
    {title}
  </button>
);

const OverviewSection: React.FC<{ users: User[] }> = ({ users }) => {
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;
  const inactiveUsers = totalUsers - activeUsers;
  const adminCount = users.filter(u => u.role === 'admin').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatsCard icon={<Users className="w-8 h-8 text-blue-500" />} title="Total Users" value={totalUsers} color="bg-blue-50" />
      <StatsCard icon={<Power className="w-8 h-8 text-green-500" />} title="Active Users" value={activeUsers} color="bg-green-50" />
      <StatsCard icon={<PowerOff className="w-8 h-8 text-red-500" />} title="Inactive Users" value={inactiveUsers} color="bg-red-50" />

      <div className="md:col-span-3">
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg flex items-center shadow-inner mt-4">
          <Info className="w-6 h-6 mr-3 text-gray-500" />
          <p className="text-gray-700">
            This dashboard provides core administrative controls. Use the tabs above to invite new users or manage existing accounts. 
            <strong> {adminCount} </strong> admin(s) currently active.
          </p>
        </div>
      </div>
    </div>
  );
};

const StatsCard: React.FC<{ icon: React.ReactNode; title: string; value: number; color: string }> = ({ icon, title, value, color }) => (
  <div className={`p-4 rounded-lg shadow-md flex items-center space-x-4 ${color}`}>
    <div className="p-3 rounded-full bg-white shadow-inner">{icon}</div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const InviteUsersSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [invitedName, setInvitedName] = useState('');
  const [companyName, setCompanyName] = useState('');
  
  // New Address State
  const [shipToAddress, setShipToAddress] = useState('');
  const [billToAddress, setBillToAddress] = useState('');
  const [sameAsShip, setSameAsShip] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isCustomerRole = role === 'customer';

  const handleSameAsShipChange = (checked: boolean) => {
    setSameAsShip(checked);
    if (checked) {
      setBillToAddress(shipToAddress);
    }
  };

  const handleShipAddressChange = (value: string) => {
    setShipToAddress(value);
    if (sameAsShip) {
      setBillToAddress(value);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteMessage(null);

    let payload: any = { email, role };

    if (isCustomerRole) {
      if (!email || !companyName.trim() || !shipToAddress.trim() || !billToAddress.trim() || !invitedName.trim() || !phoneNumber.trim()) {
        setInviteMessage({ type: 'error', text: 'Please fill in all required fields for customer invitation.' });
        return;
      }
      payload = {
        ...payload,
        company_name: companyName.trim(),
        ship_to_address: shipToAddress.trim(),
        bill_to_address: billToAddress.trim(),
        invited_name: invitedName.trim(), // Contact Person
        phone_number: phoneNumber.trim(),
      };
    } else {
      if (!email || !invitedName.trim()) {
        setInviteMessage({ type: 'error', text: 'Please fill in all required fields (Full Name, Email Address).' });
        return;
      }
      payload = {
        ...payload,
        invited_name: invitedName.trim(), // Full Name
      };
    }

    setIsInviting(true);

    try {
      const response = await api.post<InvitationResponse>(ENDPOINTS.INVITATIONS.SEND, payload);

      setInviteMessage({ type: 'success', text: response.data.message || `Invitation sent successfully to ${email}!` });
      
      // Reset form fields
      setEmail('');
      setRole('customer');
      setInvitedName('');
      setCompanyName('');
      setShipToAddress('');
      setBillToAddress('');
      setSameAsShip(false);
      setPhoneNumber('');
    } catch (error) {
      console.error('Invitation failed:', error);
      if (error && typeof error === 'object' && 'isAxiosError' in error) {
        const axiosError = error as any;
        setInviteMessage({ type: 'error', text: axiosError.response?.data?.detail || 'Failed to send invitation.' });
      } else {
        setInviteMessage({ type: 'error', text: 'An unknown error occurred.' });
      }
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white border border-blue-200 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold text-blue-700 flex items-center mb-4">
        <UserPlus className="w-6 h-6 mr-2" /> Invite New System User
      </h2>

      <form onSubmit={handleInvite} className="space-y-4">
        {inviteMessage && (
          <div
            className={`p-3 rounded-md text-sm font-medium ${
              inviteMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {inviteMessage.text}
          </div>
        )}

        {/* Assign Role */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700">
            Assign Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            required
            disabled={isInviting}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="customer">Customer</option>
            <option value="engineer">Engineer</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Fields for Staff, Engineer, Admin */}
        {!isCustomerRole && (
          <>
            <div>
              <label htmlFor="invitedName" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                id="invitedName"
                value={invitedName}
                onChange={(e) => setInvitedName(e.target.value)}
                required={!isCustomerRole}
                disabled={isInviting}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={!isCustomerRole}
                disabled={isInviting}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="user@example.com"
              />
            </div>
          </>
        )}

        {/* Fields for Customer Role */}
        {isCustomerRole && (
          <>
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                Company Name
              </label>
              <input
                type="text"
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required={isCustomerRole}
                disabled={isInviting}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="ABC Corp"
              />
            </div>

            {/* Address Section */}
            <div>
              <label htmlFor="shipToAddress" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                 <MapPin size={14}/> Ship To Address
              </label>
              <textarea
                id="shipToAddress"
                value={shipToAddress}
                onChange={(e) => handleShipAddressChange(e.target.value)}
                required={isCustomerRole}
                disabled={isInviting}
                rows={2}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 resize-none"
                placeholder="Shipping location..."
              />
            </div>

            <div>
               <div className="flex justify-between items-center mb-1">
                  <label htmlFor="billToAddress" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Receipt size={14}/> Bill To Address
                  </label>
                  <div className="flex items-center">
                    <input
                      id="sameAsShip"
                      type="checkbox"
                      checked={sameAsShip}
                      onChange={(e) => handleSameAsShipChange(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="sameAsShip" className="ml-2 block text-xs text-gray-900 cursor-pointer">
                      Same as Ship To
                    </label>
                  </div>
               </div>
              <textarea
                id="billToAddress"
                value={billToAddress}
                onChange={(e) => setBillToAddress(e.target.value)}
                required={isCustomerRole}
                disabled={isInviting || sameAsShip}
                rows={2}
                className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 resize-none ${sameAsShip ? 'bg-gray-100 text-gray-500' : ''}`}
                placeholder="Billing location..."
              />
            </div>

            <div>
              <label htmlFor="invitedName" className="block text-sm font-medium text-gray-700">
                Contact Person (Full Name)
              </label>
              <input
                type="text"
                id="invitedName"
                value={invitedName}
                onChange={(e) => setInvitedName(e.target.value)}
                required={isCustomerRole}
                disabled={isInviting}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required={isCustomerRole}
                disabled={isInviting}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="123-456-7890"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={isCustomerRole}
                disabled={isInviting}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="customer@example.com"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isInviting}
          className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-150 disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {isInviting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <UserPlus className="w-5 h-5 mr-2" />}
          {isInviting ? 'Sending...' : 'Send Invitation'}
        </button>
      </form>
    </div>
  );
};

export default AdminDashboard;