import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const MotionDiv = motion.div;

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signup(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
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
            AGROCARE
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
              AGROCARE
            </div>
          </div>

          <h1 className="text-[36px] font-extrabold text-white mb-2">Create account</h1>
          <p className="text-white/40 mb-8">Start monitoring your herd today</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none focus:border-[#65E4CF] transition-colors"
                placeholder="John Doe"
              />
            </div>
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
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none focus:border-[#65E4CF] transition-colors"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full py-3.5 text-[16px] font-semibold text-black transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#65E4CF' }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-white/40">
            Already have an account?{' '}
            <Link to="/login" className="font-medium no-underline" style={{ color: '#65E4CF' }}>
              Sign in
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
