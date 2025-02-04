import React from 'react';
import { Download, LineChart, Users, Bot } from 'lucide-react';
import { UsageData } from '../../types/admin';

interface UsageStatsProps {
  usageData: UsageData[];
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  onExport: () => void;
}

export default function UsageStats({ usageData, dateRange, onDateRangeChange, onExport }: UsageStatsProps) {
  const totalTokens = usageData.reduce((sum, log) => sum + log.tokens, 0);
  const uniqueUsers = new Set(usageData.map(log => log.user_id)).size;
  const uniqueChatbots = new Set(usageData.map(log => log.chatbot_id)).size;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium text-gray-900">
            Usage Statistics
          </h2>
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition text-sm"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-medium text-gray-900">Total Tokens</h3>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {totalTokens.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-medium text-gray-900">Active Users</h3>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {uniqueUsers}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-medium text-gray-900">Active Chatbots</h3>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {uniqueChatbots}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Usage Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chatbot
                </th>
                <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tokens Used
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usageData.map((log, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.user_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.chatbot_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {log.tokens.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}