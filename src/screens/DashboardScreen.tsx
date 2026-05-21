import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DashboardLayout from '../components/dashboard/layout/DashboardLayout';
import { useDashboard } from '../context/DashboardContext';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ route }: Props) {
  const { openEntryModal } = useDashboard();
  const navigation = useNavigation();
  const prefillType = route.params?.prefillEntry?.type;

  useEffect(() => {
    if (!prefillType) return;
    const timer = setTimeout(() => {
      openEntryModal(prefillType, null);
      (navigation as any).setParams({ prefillEntry: undefined });
    }, 100);
    return () => clearTimeout(timer);
  }, [prefillType]);

  return <DashboardLayout />;
}
