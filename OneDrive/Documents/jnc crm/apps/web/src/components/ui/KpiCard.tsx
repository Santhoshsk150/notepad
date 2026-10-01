import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedCounter } from './AnimatedCounter';

type KpiColor = 'blue' | 'amber' | 'violet' | 'teal' | 'coral' | 'green';

interface KpiCardProps {
  title: string;
  value: number;
  color: KpiColor;
  icon: React.ReactNode;
  subtitle?: string;
  breakdown?: { label: string; value: number; color?: string }[];
  index?: number;
}

const colorMap: Record<KpiColor, { bg: string; glow: string; text: string; bar: string }> = {
  blue:   { bg: 'bg-crm-blue/10',   glow: 'shadow-glow-blue',   text: 'text-crm-blue',   bar: 'bg-crm-blue' },
  amber:  { bg: 'bg-crm-amber/10',  glow: 'shadow-glow-amber',  text: 'text-crm-amber',  bar: 'bg-crm-amber' },
  violet: { bg: 'bg-crm-violet/10', glow: 'shadow-glow-violet', text: 'text-crm-violet', bar: 'bg-crm-violet' },
  teal:   { bg: 'bg-crm-teal/10',   glow: 'shadow-glow-teal',   text: 'text-crm-teal',   bar: 'bg-crm-teal' },
  coral:  { bg: 'bg-crm-coral/10',  glow: 'shadow-glow-coral',  text: 'text-crm-coral',  bar: 'bg-crm-coral' },
  green:  { bg: 'bg-crm-whatsapp/10', glow: '', text: 'text-crm-whatsapp', bar: 'bg-crm-whatsapp' },
};

export function KpiCard({ title, value, color, icon, subtitle, breakdown, index = 0 }: KpiCardProps) {
  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`card ${c.glow} relative overflow-hidden`}
    >
      {/* Background accent */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 ${c.bg} rounded-full blur-2xl`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-800 dark:text-slate-300 text-sm font-bold tracking-tight">{title}</span>
          <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center ${c.text}`}>
            {icon}
          </div>
        </div>

        <AnimatedCounter
          value={value}
          className={`text-3xl font-black ${c.text} tabular-nums tracking-tight`}
        />

        {subtitle && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">{subtitle}</p>}

        {breakdown && breakdown.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {breakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{item.label}</span>
                <span className={item.color || 'text-slate-900 dark:text-slate-200 font-bold'} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
