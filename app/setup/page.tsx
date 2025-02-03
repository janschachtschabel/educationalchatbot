'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const [setupToken, setSetupToken] = useState('');
  const [useConsolidated, setUseConsolidated] = useState(false);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const runSetup = async () => {
    try {
      setIsLoading(true);
      setStatus('Running setup...');
      
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-setup-token': setupToken,
        },
        body: JSON.stringify({
          useConsolidatedSchema: useConsolidated
        })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`Setup completed successfully! Admin credentials:
Email: ${data.adminCredentials.email}
Password: ${data.adminCredentials.password}

⚠️ Please change these credentials immediately after login.`);
        
        // Don't redirect automatically so user can see the credentials
      } else {
        setStatus(`Setup failed: ${data.error}\n${data.help || ''}`);
      }
    } catch (error) {
      setStatus('Setup failed: Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h1 className="text-3xl font-bold mb-8 text-gray-900">EduChatBot Setup</h1>
                
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Setup Token
                  </label>
                  <input
                    type="password"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Enter setup token"
                    disabled={isLoading}
                  />
                </div>

                <div className="mb-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={useConsolidated}
                      onChange={(e) => setUseConsolidated(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-blue-600"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-gray-700">Use consolidated schema (recommended for fresh installations)</span>
                  </label>
                </div>

                <button
                  onClick={runSetup}
                  disabled={isLoading || !setupToken}
                  className={`w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                    (isLoading || !setupToken) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Setting up...' : 'Run Setup'}
                </button>

                {status && (
                  <div className={`mt-4 p-4 rounded ${
                    status.includes('failed') 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    <pre className="whitespace-pre-wrap text-sm">
                      {status}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
