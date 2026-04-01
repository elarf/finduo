import React from 'react';
import { DashboardProvider } from '../context/DashboardContext';
import DashboardLayout from '../components/dashboard/layout/DashboardLayout';

export default function DashboardScreen({ route }: { route?: any }) {
  const prefillEntry = route?.params?.prefillEntry ?? null;
  return (
    <DashboardProvider prefillEntry={prefillEntry}>
      <DashboardLayout />
    </DashboardProvider>
  );
}
