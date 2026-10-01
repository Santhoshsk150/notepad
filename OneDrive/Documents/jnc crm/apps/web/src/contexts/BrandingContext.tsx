import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrandingSettings } from '../types';
import { brandingApi } from '../services/api';

const DEFAULT_BRANDING: BrandingSettings = {
  companyDisplayName: 'JS Network Communication',
  companyPhone: '+91 9663421455',
  companyLogoUrl: '/jnc-logo.jpg',
};

interface BrandingContextType {
  branding: BrandingSettings;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  updateBranding: (updated: Partial<BrandingSettings>) => Promise<BrandingSettings>;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  loading: false,
  refreshBranding: async () => {},
  updateBranding: async () => DEFAULT_BRANDING,
});

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingSettings>(() => {
    try {
      const cached = localStorage.getItem('jnc_branding');
      if (cached) return JSON.parse(cached);
    } catch {}
    return DEFAULT_BRANDING;
  });
  const [loading, setLoading] = useState(true);

  const refreshBranding = useCallback(async () => {
    try {
      const { data } = await brandingApi.get();
      if (data && data.companyDisplayName) {
        setBranding({
          companyDisplayName: data.companyDisplayName || DEFAULT_BRANDING.companyDisplayName,
          companyPhone: data.companyPhone || DEFAULT_BRANDING.companyPhone,
          companyLogoUrl: data.companyLogoUrl || DEFAULT_BRANDING.companyLogoUrl,
        });
        localStorage.setItem('jnc_branding', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Failed to load branding from API, using default branding', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  const updateBranding = async (dto: Partial<BrandingSettings>): Promise<BrandingSettings> => {
    const { data } = await brandingApi.update(dto);
    const newBranding: BrandingSettings = {
      companyDisplayName: data.companyDisplayName || DEFAULT_BRANDING.companyDisplayName,
      companyPhone: data.companyPhone || DEFAULT_BRANDING.companyPhone,
      companyLogoUrl: data.companyLogoUrl || DEFAULT_BRANDING.companyLogoUrl,
    };
    setBranding(newBranding);
    localStorage.setItem('jnc_branding', JSON.stringify(newBranding));
    return newBranding;
  };

  return (
    <BrandingContext.Provider value={{ branding, loading, refreshBranding, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
