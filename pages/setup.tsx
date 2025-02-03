import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Setup() {
  const [setupToken, setSetupToken] = useState('');
  const [status, setStatus] = useState('');
  const router = useRouter();

  const runSetup = async () => {
    try {
      setStatus('Running setup...');
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: {
          'x-setup-token': setupToken,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('Setup completed successfully!');
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        setStatus(`Setup failed: ${data.error}`);
      }
    } catch (error) {
      setStatus('Setup failed: Network error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-2xl font-bold mb-8">EduChatBot Setup</h2>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Setup Token
                  </label>
                  <input
                    type="password"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Enter setup token"
                  />
                </div>
                <button
                  onClick={runSetup}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Run Setup
                </button>
                {status && (
                  <div className="mt-4 text-sm text-gray-600">
                    {status}
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
