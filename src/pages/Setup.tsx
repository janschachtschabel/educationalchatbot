import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Shield, Check, AlertCircle, RefreshCw, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Get setup token from environment variable
const SETUP_TOKEN = import.meta.env.VITE_SETUP_TOKEN;

export default function Setup() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [dbEmpty, setDbEmpty] = useState<boolean | null>(null);
  const [setupStatus, setSetupStatus] = useState<{
    [key: string]: 'pending' | 'running' | 'success' | 'error';
  }>({
    check: 'pending',
    auth: 'pending',
    database: 'pending',
    storage: 'pending',
    admin: 'pending'
  });

  // Check if setup is allowed and database is empty
  useEffect(() => {
    if (!SETUP_TOKEN) {
      navigate('/');
      return;
    }

    checkDatabase();
  }, [navigate]);

  const checkDatabase = async () => {
    setSetupStatus(prev => ({ ...prev, check: 'running' }));
    try {
      // Check if any tables have data
      const tables = ['profiles', 'chatbot_templates', 'chat_sessions', 'usage_logs'];
      let hasData = false;

      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (count && count > 0) {
          hasData = true;
          break;
        }
      }

      setDbEmpty(!hasData);
      setSetupStatus(prev => ({ ...prev, check: 'success' }));
    } catch (err) {
      console.error('Database check error:', err);
      setError('Failed to check database status');
      setSetupStatus(prev => ({ ...prev, check: 'error' }));
    }
  };

  const verifyToken = () => {
    return token === SETUP_TOKEN;
  };

  const runSetup = async () => {
    if (!verifyToken()) {
      setError('Invalid setup token');
      return;
    }

    if (!dbEmpty) {
      setError('Database is not empty. Please clear it before running setup.');
      return;
    }

    if (!adminPassword || adminPassword.length < 8) {
      setError('Please provide a secure admin password (min. 8 characters)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check auth connection
      setSetupStatus(prev => ({ ...prev, auth: 'running' }));
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      setSetupStatus(prev => ({ ...prev, auth: 'success' }));

      // Check database connection
      setSetupStatus(prev => ({ ...prev, database: 'running' }));
      const { error: dbError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      if (dbError && dbError.code !== 'PGRST116') throw dbError;
      setSetupStatus(prev => ({ ...prev, database: 'success' }));

      // Check storage bucket
      setSetupStatus(prev => ({ ...prev, storage: 'running' }));
      const { error: storageError } = await supabase
        .storage
        .getBucket('documents');
      if (storageError) throw storageError;
      setSetupStatus(prev => ({ ...prev, storage: 'success' }));

      // Create admin user
      setSetupStatus(prev => ({ ...prev, admin: 'running' }));
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'admin@admin.de',
        password: adminPassword,
        options: {
          data: {
            full_name: 'System Admin',
            is_admin: true
          }
        }
      });

      if (signUpError) throw signUpError;

      // Show success message with admin credentials
      const successMessage = `
Setup completed successfully!

Admin Credentials:
Email: admin@admin.de
Password: ${adminPassword}

Please save these credentials and change the password after first login.
      `.trim();

      alert(successMessage);

      setSetupStatus(prev => ({ ...prev, admin: 'success' }));

      // Redirect to home after successful setup
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      console.error('Setup error:', err);
      setError(err instanceof Error ? err.message : 'Setup failed');
      
      // Mark failed step
      const failedStep = Object.entries(setupStatus).find(([_, status]) => status === 'running')?.[0];
      if (failedStep) {
        setSetupStatus(prev => ({ ...prev, [failedStep]: 'error' }));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!SETUP_TOKEN) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Database className="h-12 w-12 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Database Setup
          </h2>
          {dbEmpty === false && (
            <p className="mt-2 text-center text-sm text-red-600">
              Warning: Database is not empty. Setup will not proceed.
            </p>
          )}
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md space-y-6">
          {/* Setup Token Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Setup Token
            </label>
            <div className="mt-1 relative">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={loading || dbEmpty === false}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Shield className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Admin Password Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Admin Password
            </label>
            <div className="mt-1 relative">
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={loading || dbEmpty === false}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Key className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Setup Steps */}
          <div className="space-y-3">
            {Object.entries(setupStatus).map(([step, status]) => (
              <div key={step} className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">
                  {step === 'check' ? 'Database Check' : `${step} Connection`}
                </span>
                <div className="flex items-center">
                  {status === 'pending' && (
                    <div className="h-5 w-5 text-gray-400">•</div>
                  )}
                  {status === 'running' && (
                    <RefreshCw className="h-5 w-5 text-indigo-600 animate-spin" />
                  )}
                  {status === 'success' && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                  {status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            onClick={runSetup}
            disabled={loading || !token || !adminPassword || dbEmpty === false}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Run Setup'}
          </button>
        </div>
      </div>
    </div>
  );
}