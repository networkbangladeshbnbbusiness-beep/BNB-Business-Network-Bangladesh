import React from 'react';
import BnbSalaryAdmin from '../BnbSalaryAdmin';

interface AdminSalarySectionProps {
  adminTab: string;
  setViewingGrid: (viewing: boolean) => void;
  setAdminTab: (tab: any) => void;
}

export default function AdminSalarySection({
  adminTab,
  setViewingGrid,
  setAdminTab
}: AdminSalarySectionProps) {
  if (adminTab !== 'salary_admin') return null;

  return (
    <div className="w-full text-left animate-fade-in" id="admin-salary-section">
      <BnbSalaryAdmin 
        onBack={() => {
          setViewingGrid(true);
          setAdminTab('general');
        }}
      />
    </div>
  );
}
