/**
 * Landing page — NeuroSync entry point.
 */

'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-xl px-6"
      >
        <div className="text-6xl mb-6">🧠</div>

        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          NeuroSync
        </h1>

        <p className="text-white/50 text-lg mb-2">
          AI-powered cognitive load monitoring for developers
        </p>
        <p className="text-white/30 text-sm mb-10">
          Real-time focus tracking · Blink detection · AI insights via Sarvam & Mistral
        </p>

        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/dashboard')}
          className="px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold text-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-shadow"
        >
          Launch Dashboard →
        </motion.button>
      </motion.div>
    </div>
  );
}
