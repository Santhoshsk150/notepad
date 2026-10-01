import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function TeamPageGuard({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Project team roles (Project Manager, Developer Lead, Developer) are strictly scoped to Daily Activities ONLY
  const isProjectRole = ['project_manager', 'developer_lead', 'developer'].includes(user?.role || '');
  if (isProjectRole) {
    if (pageKey !== 'daily_activities') {
      return <Navigate to="/daily-activities" replace />;
    }
    return <>{children}</>;
  }

  if (user?.role === 'super_admin') return <>{children}</>;
  
  if (user?.teamId && user?.teamRef) {
    let allowedPages: string[] = [];
    try {
      allowedPages = typeof user.teamRef.allowedPages === 'string' 
        ? JSON.parse(user.teamRef.allowedPages || '[]') 
        : (user.teamRef.allowedPages || []);
    } catch {
      allowedPages = [];
    }
      
    if (allowedPages.length > 0 && !allowedPages.includes(pageKey)) {
      return <Navigate to="/" replace />;
    }
  }
  
  // No team ID means full role access, or page is explicitly allowed
  return <>{children}</>;
}

