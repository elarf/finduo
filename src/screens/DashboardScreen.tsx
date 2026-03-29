import React from 'react';
import { DashboardProvider } from '../context/DashboardContext';
import DashboardLayout from '../components/dashboard/layout/DashboardLayout';

export default function DashboardScreen() {
  return (
    <DashboardProvider>
      <DashboardLayout />
    </DashboardProvider>
  );
}
