import React from 'react';
import { Lock, UserPlus, Check, X } from 'lucide-react';
import { User } from '../../types/admin';

interface UserManagementProps {
  users: User[];
  onToggleBlock: (userId: string, isBlocked: boolean) => void;
  onUpdateLimit: (userId: string, limit: number | null) => void;
  onAddUser: () => void;
}

export default function UserManagement({ users, onToggleBlock, onUpdateLimit, onAddUser }: UserManagementProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">
          User Management
        </h2>
        <button
          onClick={onAddUser}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
        >
          <UserPlus className="h-5 w-5" />
          Add User
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usage Limit
              </th>
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.full_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.is_admin
                      ? 'bg-purple-100 text-purple-800'
                      : user.role === 'teacher'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {user.is_admin ? 'Admin' : user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={user.usage_limit || 'unlimited'}
                    onChange={(e) => onUpdateLimit(
                      user.id,
                      e.target.value === 'unlimited' ? null : Number(e.target.value)
                    )}
                    className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  >
                    <option value="unlimited">Unlimited</option>
                    <option value="1000">1,000</option>
                    <option value="5000">5,000</option>
                    <option value="10000">10,000</option>
                    <option value="50000">50,000</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.is_blocked
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {user.is_blocked ? (
                      <>
                        <X className="h-3 w-3" />
                        Blocked
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3" />
                        Active
                      </>
                    )}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onToggleBlock(user.id, user.is_blocked)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium ${
                      user.is_blocked
                        ? 'text-green-700 bg-green-50 hover:bg-green-100'
                        : 'text-red-700 bg-red-50 hover:bg-red-100'
                    }`}
                  >
                    <Lock className="h-4 w-4" />
                    {user.is_blocked ? 'Unblock' : 'Block'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}