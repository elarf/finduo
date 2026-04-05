import React from 'react';
import { StyleProp, Text, TouchableOpacity, ViewStyle } from 'react-native';
import Icon from './Icon';
import { styles } from '../screens/DashboardScreen.styles';
import { logUI, uiPath, uiProps } from '../lib/devtools';

type DateButtonProps = {
  date: string;
  onPress: () => void;
  screen: string;
  component?: string;
  style?: StyleProp<ViewStyle>;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function DateButton({ date, onPress, screen, component = 'form', style }: DateButtonProps) {
  const today = todayIso();
  const label = date
    ? (date === today ? `${date}, Today` : date)
    : 'Select date';

  return (
    <TouchableOpacity
      {...uiProps(uiPath(screen, component, 'date_button'))}
      style={[styles.datePressable, style]}
      onPress={() => {
        logUI(uiPath(screen, component, 'date_button'), 'press');
        onPress();
      }}
    >
      <Icon name="calendar" size={18} color="#8FA8C9" />
      <Text style={styles.datePressableText}>{label}</Text>
    </TouchableOpacity>
  );
}
