import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const MotionDiv = motion.div;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Left — image (hidden on mobile) */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <img
          src="/images/auth-bg.jpg"
          alt=""
          className="h-full w-full object-cover brightness-[0.4]"
          style={{ transform: 'translate3d(0,0,0)' }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-12">
          <div
            className="text-[64px] font-extrabold tracking-widest"
            style={{ color: '#65E4CF' }}
          >
            SKIDO
          </div>
          <p className="mt-4 text-center text-[20px] font-light italic text-white/50">
            Early Detection. Healthier Herds.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        <MotionDiv
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="lg:hidden mb-8 text-center">
            <div className="text-[40px] font-extrabold tracking-widest" style={{ color: '#65E4CF' }}>
              SKIDO
            </div>
          </div>

          <h1 className="text-[36px] font-extrabold text-white mb-2">Welcome back</h1>
          <p className="text-white/40 mb-8">Sign in to your account</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none focus:border-[#65E4CF] transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none focus:border-[#65E4CF] transition-colors"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full py-3.5 text-[16px] font-semibold text-black transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#65E4CF' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-white/40">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium no-underline" style={{ color: '#65E4CF' }}>
              Sign up
            </Link>
          </div>
          <div className="mt-3 text-center">
            <Link to="/" className="text-sm text-white/30 hover:text-white/50 no-underline">
              &larr; Back to home
            </Link>
          </div>
        </MotionDiv>
      </div>
    </div>
  );
}
