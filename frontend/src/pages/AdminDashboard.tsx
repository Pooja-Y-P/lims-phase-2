import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider'; 
import { User, UserRole } from '../types'; 
import { api, ENDPOINTS } from '../api/config'; 
import { Shield, Power, PowerOff, UserPlus, Users, Info, Loader2 } from 'lucide-react';
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
const UserManagementTable: React.FC<{ users: User[] }> = ({ users }) => (
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
              {activeTab === 'Manage Users' && <UserManagementTable users={users} />}
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
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !role || !invitedName.trim()) {
      setInviteMessage({ type: 'error', text: 'Please fill in all required fields (name, email, role).' });
      return;
    }

    setIsInviting(true);
    setInviteMessage(null);

    try {
      const response = await api.post<InvitationResponse>(ENDPOINTS.INVITATIONS.SEND, {
        email,
        role,
        invited_name: invitedName.trim(),
      });

      setInviteMessage({ type: 'success', text: response.data.message || `Invitation sent successfully to ${email}!` });
      setEmail('');
      setInvitedName('');
      setRole('customer');
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

        <div>
          <label htmlFor="invitedName" className="block text-sm font-medium text-gray-700">
            Full Name
          </label>
          <input
            type="text"
            id="invitedName"
            value={invitedName}
            onChange={(e) => setInvitedName(e.target.value)}
            required
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
            required
            disabled={isInviting}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            placeholder="user@example.com"
          />
        </div>

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
