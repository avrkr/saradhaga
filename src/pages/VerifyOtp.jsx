import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import AuthLayout from '../components/AuthLayout';
import Spinner from '../components/Spinner';

const VerifyOtp = () => {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const email = location.state?.email;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp });
      login(data.user, data.token);
      toast.success('Verified successfully!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) {
    navigate('/signup');
    return null;
  }

  return (
    <AuthLayout 
      title="Verify your email" 
      subtitle={`We sent a code to ${email}`}
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
            Enter OTP
          </label>
          <div className="mt-1">
            <input
              id="otp"
              name="otp"
              type="text"
              required
              className="appearance-none block w-full px-3 py-4 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary text-center text-2xl tracking-[0.5em] font-bold transition-colors"
              placeholder="••••••"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? <Spinner size="sm" color="white" /> : 'Verify'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
};

export default VerifyOtp;
