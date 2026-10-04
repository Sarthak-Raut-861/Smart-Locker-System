"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/Skeletons";
import { Settings, Save, Server, Clock, Bell, Palette } from "lucide-react";
import { motion } from "framer-motion";

interface SettingsState {
  minDuration: number;
  maxDuration: number;
  autoLockDelay: number;
  vibrationSensitivity: number;
  systemName: string;
  supportEmail: string;
  baseHourlyRate: number;
}

const DEFAULTS: SettingsState = {
  minDuration: 1,
  maxDuration: 48,
  autoLockDelay: 5,
  vibrationSensitivity: 3,
  systemName: "LocknLeave",
  supportEmail: "support@locknleave.io",
  baseHourlyRate: 25,
};

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl border border-white/5 p-6"
    >
      <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-5">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </motion.div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="sm:w-52">{children}</div>
    </div>
  );
}

function Input({ value, onChange, type = "text", ...props }: any) {
  return (
    <input
      type={type} value={value} onChange={onChange} {...props}
      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
    />
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<SettingsState>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  const field = (key: keyof SettingsState) => ({
    value: s[key],
    onChange: (e: any) => setS(prev => ({ ...prev, [key]: ["minDuration","maxDuration","autoLockDelay","vibrationSensitivity","baseHourlyRate"].includes(key) ? Number(e.target.value) : e.target.value })),
  });

  const handleSave = () => {
    // In production: setDoc(doc(db, "settings", "system"), s)
    console.log("Settings saved:", s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" subtitle="Configure system-wide behaviour and hardware parameters." />

      <Section icon={Clock} title="Session Controls">
        <Field label="Minimum Duration" desc="Shortest allowed booking (in hours)">
          <Input type="number" step="0.5" min="0.5" {...field("minDuration")} />
        </Field>
        <Field label="Maximum Duration" desc="Longest allowed booking (in hours)">
          <Input type="number" step="1" min="1" max="72" {...field("maxDuration")} />
        </Field>
      </Section>

      <Section icon={Server} title="Hardware Parameters">
        <Field label="Auto-Lock Delay" desc="Seconds before locker re-locks after door opens">
          <Input type="number" min="1" max="60" {...field("autoLockDelay")} />
        </Field>
        <Field label="Vibration Sensitivity" desc="Scale 1 (low) to 5 (high) for tamper detection">
          <div className="flex items-center gap-3">
            <input type="range" min="1" max="5" className="flex-1 accent-primary" {...field("vibrationSensitivity")} />
            <span className="text-sm font-bold text-primary w-4">{s.vibrationSensitivity}</span>
          </div>
        </Field>
      </Section>

      <Section icon={Palette} title="Branding">
        <Field label="System Name" desc="Displayed across all user-facing interfaces">
          <Input {...field("systemName")} />
        </Field>
        <Field label="Support Email" desc="Contact shown in booking confirmation emails">
          <Input type="email" {...field("supportEmail")} />
        </Field>
      </Section>

      <Section icon={Bell} title="Default Pricing">
        <Field label="Base Hourly Rate (₹)" desc="Baseline rate before surge multiplier is applied">
          <Input type="number" min="1" step="5" {...field("baseHourlyRate")} />
        </Field>
      </Section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg ${saved ? "bg-emerald-500 text-white shadow-emerald-500/30" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"}`}
        >
          <Save className="w-4 h-4" />
          {saved ? "Saved Successfully!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
