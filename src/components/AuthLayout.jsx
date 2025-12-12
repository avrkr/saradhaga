import React from 'react';
import { Link } from 'react-router-dom';

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left Side - Brand/Image */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent opacity-90"></div>
        <div className="relative z-10 text-center px-10">
          <div className="flex justify-center mb-6">
            <img src="/favicon.svg" alt="Saradhaga Logo" className="h-24 w-24" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-6">Saradhaga</h1>
          <p className="text-xl text-white/90 max-w-md mx-auto">
            Connect, chat, and have fun with friends in real-time voice rooms.
          </p>
          
          {/* Decorative circles */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-accent/20 rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 bg-white">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="text-center lg:text-left">
            <Link to="/" className="lg:hidden flex items-center justify-center lg:justify-start mb-8">
              <img src="/favicon.svg" alt="Saradhaga Logo" className="h-12 w-12 mr-2" />
              <span className="text-3xl font-bold text-primary">Saradhaga</span>
            </Link>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">{title}</h2>
            {subtitle && (
              <p className="mt-2 text-sm text-gray-600">
                {subtitle}
              </p>
            )}
          </div>

          <div className="mt-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
