import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Phone, Upload, Image as ImageIcon, CheckCircle2,
  Trash2, ShieldCheck, RefreshCw, Sparkles, AlertCircle, ArrowLeft
} from 'lucide-react';
import { useBranding } from '../contexts/BrandingContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function BrandingSettingsPage() {
  const { branding, updateBranding, refreshBranding } = useBranding();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const [companyName, setCompanyName] = useState(branding.companyDisplayName);
  const [companyPhone, setCompanyPhone] = useState(branding.companyPhone);
  const [logoPreview, setLogoPreview] = useState<string | null>(branding.companyLogoUrl);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanyName(branding.companyDisplayName);
    setCompanyPhone(branding.companyPhone);
    setLogoPreview(branding.companyLogoUrl);
  }, [branding]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Logo file size must be under 2MB.');
      return;
    }

    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleResetToDefaultLogo = () => {
    setLogoPreview('/jnc-logo.jpg');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMessage('Security Policy: Only Administrators can update Company Branding.');
      return;
    }

    if (!companyName.trim()) {
      setErrorMessage('Company Name is required.');
      return;
    }

    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await updateBranding({
        companyDisplayName: companyName.trim(),
        companyPhone: companyPhone.trim(),
        companyLogoUrl: logoPreview || null,
      });

      setSuccessMessage('Company Branding successfully updated! All UI headers, footers, and outgoing emails are now in sync.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to update branding settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="card text-center py-16 space-y-4 max-w-lg mx-auto mt-12">
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 text-red-500 mx-auto flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          Only Super Administrators and Administrators have permission to modify central company branding settings.
        </p>
        <button onClick={() => navigate('/')} className="btn-secondary text-xs inline-flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2A3042]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-crm-blue/10 dark:bg-crm-blue/20 text-crm-blue border border-crm-blue/30">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950 dark:text-white">Company Branding Settings</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Centralized branding configuration driving UI chrome (header/footer) and all outgoing email templates.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refreshBranding()}
          className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
          title="Reload Branding from Server"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ─── ALERTS ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-3 text-xs font-semibold shadow-sm"
          >
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center gap-3 text-xs font-semibold shadow-sm"
          >
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── BRANDING DETAILS CARD ───────────────────────────────────────── */}
        <div className="card space-y-5">
          <div className="border-b border-slate-200 dark:border-[#2A3042] pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles size={16} className="text-crm-blue" />
              General Organization Identity
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              These details appear across the CRM portal header, mobile dock, footer, invoices, and automated notifications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                Company Display Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="input text-xs pl-8"
                  placeholder="e.g. JS Network Communication"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
                <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Used in header logos, page titles, dispatch notifications, and PDF billing summaries.
              </p>
            </div>

            <div>
              <label className="label">Official Phone / Hotline</label>
              <div className="relative">
                <input
                  type="text"
                  className="input text-xs pl-8 font-mono"
                  placeholder="e.g. +91 9663421455 / +91 9964219891"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                />
                <Phone size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Included in outbound customer emails and the footer support hotline.
              </p>
            </div>
          </div>
        </div>

        {/* ─── LOGO ASSET & PREVIEW CARD ──────────────────────────────────── */}
        <div className="card space-y-5">
          <div className="border-b border-slate-200 dark:border-[#2A3042] pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ImageIcon size={16} className="text-crm-teal" />
              Company Logo Asset & Live Preview
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Upload your company logo. PNG, JPG, or SVG with a transparent or white background recommended.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Live Preview Box */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-[#2A3042] bg-slate-50/50 dark:bg-[#1E2230]/40 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Live Chrome Preview</div>
              <div className="h-16 w-48 px-4 py-2 rounded-xl bg-white flex items-center justify-center shadow-md border border-slate-200">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt={companyName || 'Company Logo'}
                    className="max-h-12 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs font-bold text-slate-400">No Logo Configured</span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-3">{companyName || 'Company Name'}</p>
              <p className="text-[10px] text-slate-500 font-mono">{companyPhone || 'No Phone'}</p>
            </div>

            {/* Uploader Controls */}
            <div className="md:col-span-7 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoFileChange}
                className="hidden"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary text-xs flex items-center gap-1.5 shadow-glow-blue"
                >
                  <Upload size={14} /> Upload Custom Logo
                </button>

                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="btn-secondary text-xs text-red-500 hover:text-red-600 flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Clear Logo
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetToDefaultLogo}
                  className="btn-ghost text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
                  title="Reset to default /jnc-logo.jpg"
                >
                  Reset Default
                </button>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <p>• Recommended dimension: <strong>300x80px</strong> or proportional aspect ratio.</p>
                <p>• Max file size: <strong>2 MB</strong>.</p>
                <p>• Saved centrally and synced instantly across all active client browsers and email templates.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── ACTION BUTTONS ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-ghost text-xs px-4"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary text-xs px-6 py-2.5 shadow-glow-blue flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>Save Branding Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
