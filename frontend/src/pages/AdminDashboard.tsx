import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider'; 
import { User } from '../types'; 
//  NEW: Import API configuration directly
import { api, ENDPOINTS } from '../api/config'; 
import { Shield, Power, PowerOff, UserPlus, Users, Info } from 'lucide-react';

//  Assuming these components are available in the correct paths:
import Header from '../components/Header';
import Footer from '../components/Footer';

type AdminViewTab = 'Overview' | 'Invite Users' | 'Manage Users';

const AdminDashboard: React.FC = () => {
  //  The user object in the frontend's AuthContext must contain the 'token'.
  const { user, logout } = useAuth(); 
  
  const [activeTab, setActiveTab] = useState<AdminViewTab>('Overview');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    //  Ensure user is available and has a token before fetching data
    if (!user || !user.token) {
        setLoading(false);
        if (user) logout(); 
        return; 
    }
    
    setLoading(true);
    setError('');
    
    try {
        console.log('Fetching all users from backend API...');
        
        // 🛑 API CALL IS NOW INLINE: Using api instance and ENDPOINTS constant
        const response = await api.get(ENDPOINTS.USERS.ALL_USERS, {
            headers: {
                Authorization: `Bearer ${user.token}`,
            },
        });

        // Assuming the FastAPI backend returns data in a structure like: {"users": [...]}
        setUsers(response.data.users as User[]);
        
    } catch (e) {
        console.error("Error fetching admin data:", e);
        setError('Failed to fetch admin data. Check network, authentication, or admin permissions.');
    } finally {
        setLoading(false);
    }
  }, [user, logout]); 

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = () => {
    if (logout) { 
      console.log("Logout triggered from AdminDashboard.");
      logout(); 
    } else {
      console.warn("Logout function not available on AuthProvider. Cannot log out.");
      alert("Logout function failed! Check AuthProvider implementation.");
    }
  };


  // --- Helper for Header Props ---
  const headerProps = {
    username: user?.full_name || user?.username || 'Guest',
    role: user?.role,
    onLogout: handleLogout,
  };
  
  // --- Handle Loading and Error States (Wrapped in single parent) ---
  const renderLoadingOrError = (content: React.ReactNode) => (
    <div className="min-h-screen flex flex-col justify-between bg-gray-50">
      <Header {...headerProps} />
      <div className="flex-grow p-8 text-center text-xl">{content}</div>
      <Footer />
    </div>
  );

  if (loading) {
    return renderLoadingOrError("Loading Admin Data...");
  }
    
  if (!user) {
    return renderLoadingOrError("Redirecting..."); 
  }

  if (error) {
    return renderLoadingOrError(<div className="text-red-600 border border-red-300 bg-red-50 p-4 rounded">{error}</div>);
  }
  // ----------------------------------------

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      
      {/* 🛑 Header with User Info and Logout */}
      <Header {...headerProps} />
      
      {/* Main Content Wrapper */}
      <div className="flex-grow bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          
          {/* Top Header Section */}
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center mb-1">
              <Shield className="w-8 h-8 mr-3 text-blue-600" />
              Admin Control Panel
            </h1>
            <p className="text-gray-600 font-medium ml-11">
              Welcome, {user?.full_name || user?.username} ({user?.role})
            </p>
          </div>
          
          {/* Main Content Card */}
          <div className="bg-white rounded-lg shadow-xl overflow-hidden p-6">

            {/* Tab Navigation */}
            <nav className="flex border-b border-gray-200 mb-6">
              <TabButton 
                title="Overview" 
                activeTab={activeTab} 
                setActiveTab={setActiveTab}
              />
              <TabButton 
                title="Invite Users" 
                activeTab={activeTab} 
                setActiveTab={setActiveTab}
              />
              <TabButton 
                title="Manage Users" 
                activeTab={activeTab} 
                setActiveTab={setActiveTab}
              />
            </nav>

            {/* Tab Content */}
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

export default AdminDashboard;

// ---------------------------------------------------------------------
// 🛑 Helper Components (Defined below for completeness)
// ---------------------------------------------------------------------

// --- Tab Button Component (No change) ---
const TabButton: React.FC<{ 
    title: AdminViewTab; 
    activeTab: AdminViewTab; 
    setActiveTab: (tab: AdminViewTab) => void 
}> = ({ title, activeTab, setActiveTab }) => (
  <button
    onClick={() => setActiveTab(title)}
    className={`px-6 py-3 text-lg font-semibold -mb-px transition-colors ${
      activeTab === title
        ? 'border-b-4 border-blue-600 text-blue-700'
        : 'text-gray-500 hover:text-gray-700'
    }`}
  >
    {title}
  </button>
);

// --- 1. Overview Section (No change) ---
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
                        This dashboard provides core administrative controls. Use the tabs above to invite new users or manage existing accounts. **{adminCount}** user(s) currently hold the **admin** role.
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- Overview Helper Card (No change) ---
const StatsCard: React.FC<{ icon: React.ReactNode, title: string, value: number, color: string }> = ({ icon, title, value, color }) => (
    <div className={`p-4 rounded-lg shadow-md flex items-center space-x-4 ${color}`}>
        <div className="p-3 rounded-full bg-white shadow-inner">
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
        </div>
        
    </div>
);

// --- 2. Invite Users Section (No change) ---
const InviteUsersSection: React.FC = () => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('customer');

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !role) {
            alert("Please enter a valid email and select a role.");
            return;
        }
        alert(`Simulating invitation for: ${email} with role: ${role}`);
        setEmail('');
        setRole('customer');
    };

    return (
        <div className="max-w-xl mx-auto p-6 bg-white border border-blue-200 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold text-blue-700 flex items-center mb-4">
                <UserPlus className="w-6 h-6 mr-2" /> Invite New System User
            </h2>
            <form onSubmit={handleInvite} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="user@example.com"
                    />
                </div>
                <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">Assign Role</label>
                    <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="customer">Customer</option>
                        <option value="engineer">Engineer</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <button
                    type="submit"
                    className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-150"
                >
                    <UserPlus className="w-5 h-5 mr-2" /> Send Invitation
                </button>
            </form>
        </div>
    );
};

// --- 3. Manage Users Table (No change) ---
const UserManagementTable: React.FC<{ users: User[] }> = ({ users }) => (
  <div className="border border-gray-200 rounded-lg overflow-hidden">
    <div className="p-4 bg-gray-50 border-b">
      <h3 className="text-xl font-semibold text-gray-700">System Users ({users.length})</h3>
      </div>
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-blue-50 text-gray-600 uppercase tracking-wider">
          <th className="p-3 font-bold">Full Name</th>
          <th className="p-3 font-bold">Email</th>
          <th className="p-3 font-bold">Role</th>
          <th className="p-3 font-bold">Status</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.user_id} className="border-b last:border-b-0 hover:bg-gray-100 transition-colors">
            <td className="p-3 text-gray-800">{u.full_name || u.username}</td>
            <td className="p-3 text-gray-600">{u.email}</td>
            <td className="p-3 capitalize text-blue-600 font-medium">{u.role}</td>
            <td className="p-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                u.is_active 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {u.is_active ? (
                  <Power className="w-3 h-3 mr-1" />
                ) : (
                  <PowerOff className="w-3 h-3 mr-1" />
                )}
                {u.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);