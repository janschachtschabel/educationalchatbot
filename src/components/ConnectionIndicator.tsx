import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ConnectionIndicator() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Initial connection check
    checkConnection();

    // Set up periodic checks
    const interval = setInterval(checkConnection, 10000);

    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .maybeSingle();

      setIsConnected(!error);
    } catch (err) {
      setIsConnected(false);
    }
  };

  return (
    <div 
      className={`w-2 h-2 rounded-full ${
        isConnected ? 'bg-green-500' : 'bg-red-500'
      } transition-colors duration-300`}
      title={isConnected ? 'Verbunden' : 'Keine Verbindung'}
    />
  );
}