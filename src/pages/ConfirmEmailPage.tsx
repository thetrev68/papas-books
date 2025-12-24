import { useEffect } from 'react';
import { supabase } from '../lib/supabase/config';

export default function ConfirmEmailPage() {
  useEffect(() => {
    const handleEmailConfirmation = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Email confirmation error:', error);
      } else if (data.session) {
        // Redirect to dashboard
        window.location.href = '/app/dashboard';
      }
    };

    handleEmailConfirmation();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Confirming your email...</h1>
        <p className="text-gray-600">Please wait while we verify your account.</p>
      </div>
    </div>
  );
}
