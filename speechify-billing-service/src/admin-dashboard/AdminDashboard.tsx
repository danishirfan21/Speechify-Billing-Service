import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Search,
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  Download,
  RefreshCw,
} from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    analytics: {
      totalRevenue: 0,
      totalCustomers: 0,
      activeSubscriptions: 0,
      churnRate: 0,
      mrr: 0,
      arr: 0,
    },
    recentSubscriptions: [],
    failedPayments: [],
    revenueChart: [],
    subscriptionChart: [],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Mock data for demonstration
  useEffect(() => {
    const mockData = {
      analytics: {
        totalRevenue: 145670.5,
        totalCustomers: 1247,
        activeSubscriptions: 892,
        churnRate: 4.2,
        mrr: 48500.0,
        arr: 582000.0,
      },
      recentSubscriptions: [
        {
          id: '1',
          customer: 'Acme Corp',
          plan: 'Pro',
          amount: 199.99,
          status: 'active',
          created: '2024-01-15',
        },
        {
          id: '2',
          customer: 'TechStart Inc',
          plan: 'Premium',
          amount: 99.99,
          status: 'trialing',
          created: '2024-01-14',
        },
        {
          id: '3',
          customer: 'Global Solutions',
          plan: 'Pro',
          amount: 199.99,
          status: 'active',
          created: '2024-01-13',
        },
        {
          id: '4',
          customer: 'Innovation Labs',
          plan: 'Premium',
          amount: 99.99,
          status: 'past_due',
          created: '2024-01-12',
        },
        {
          id: '5',
          customer: 'Digital Agency',
          plan: 'Pro',
          amount: 199.99,
          status: 'active',
          created: '2024-01-11',
        },
      ],
      failedPayments: [
        {
          id: '1',
          customer: 'Innovation Labs',
          amount: 99.99,
          reason: 'Insufficient funds',
          attempts: 2,
          nextRetry: '2024-01-16',
        },
        {
          id: '2',
          customer: 'Startup Co',
          amount: 199.99,
          reason: 'Card expired',
          attempts: 1,
          nextRetry: '2024-01-15',
        },
        {
          id: '3',
          customer: 'Small Business',
          amount: 49.99,
          reason: 'Payment declined',
          attempts: 3,
          nextRetry: '2024-01-17',
        },
      ],
      revenueChart: [
        { month: 'Oct', revenue: 42000, subscriptions: 780 },
        { month: 'Nov', revenue: 45000, subscriptions: 820 },
        { month: 'Dec', revenue: 48000, subscriptions: 860 },
        { month: 'Jan', revenue: 48500, subscriptions: 892 },
      ],
      subscriptionChart: [
        { name: 'Free', value: 355, color: '#94A3B8' },
        { name: 'Premium', value: 432, color: '#3B82F6' },
        { name: 'Pro', value: 460, color: '#10B981' },
      ],
    };
    setData(mockData);
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleExport = () => {
    // Simulate CSV export
    const csvContent = `Customer,Plan,Amount,Status,Created\n${data.recentSubscriptions
      .map((sub) => `${sub.customer},${sub.plan},$${sub.amount},${sub.status},${sub.created}`)
      .join('\n')}`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscriptions.csv';
    a.click();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'trialing':
        return 'text-blue-600 bg-blue-100';
      case 'past_due':
        return 'text-red-600 bg-red-100';
      case 'canceled':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredSubscriptions = data.recentSubscriptions.filter(
    (sub) =>
      sub.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.plan.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Speechify Billing Admin</h1>
              <p className="text-gray-600">Manage subscriptions, payments, and analytics</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {['overview', 'subscriptions', 'payments', 'analytics'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${data.analytics.totalRevenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Customers</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {data.analytics.totalCustomers.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Active Subscriptions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {data.analytics.activeSubscriptions.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Churn Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{data.analytics.churnRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Revenue Chart */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.revenueChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']} />
                    <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Subscription Distribution */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Subscription Plans</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.subscriptionChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.subscriptionChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center space-x-6 mt-4">
                  {data.subscriptionChart.map((entry, index) => (
                    <div key={index} className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-2`}
                        style={{ backgroundColor: entry.color }}
                      ></div>
                      <span className="text-sm text-gray-600">
                        {entry.name}: {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Failed Payments */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Failed Payments</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Attempts
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Next Retry
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.failedPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.customer}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${payment.amount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.reason}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.attempts}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.nextRetry}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button className="text-indigo-600 hover:text-indigo-900">Retry</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="relative flex-1 max-w-lg">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search customers or plans..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex space-x-4">
                  <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    <option>All Status</option>
                    <option>Active</option>
                    <option>Trialing</option>
                    <option>Past Due</option>
                    <option>Canceled</option>
                  </select>
                  <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    <option>All Plans</option>
                    <option>Free</option>
                    <option>Premium</option>
                    <option>Pro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Subscriptions Table */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Recent Subscriptions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Plan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSubscriptions.map((subscription) => (
                      <tr key={subscription.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {subscription.customer}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {subscription.plan}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${subscription.amount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                              subscription.status,
                            )}`}
                          >
                            {subscription.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {subscription.created}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                            View
                          </button>
                          <button className="text-red-600 hover:text-red-900">Cancel</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Other tabs would go here */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Management</h3>
            <p className="text-gray-600">Payment management features would be implemented here.</p>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Analytics</h3>
            <p className="text-gray-600">Advanced analytics dashboard would be implemented here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
