import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../screens/DashboardScreen.styles';
import { logUI, uiPath, uiProps } from '../lib/devtools';

type NumpadGridProps = {
  keys: readonly string[] | string[];
  onPress: (key: string) => void;
  flashColor: string;
  screen: string;
  component?: string;
};

export const ENTRY_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '00', 'C', '000', '<'] as const;
export const RATE_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'C', '<'] as const;

export default function NumpadGrid({ keys, onPress, flashColor, screen, component = 'numpad' }: NumpadGridProps) {
  return (
    <View style={styles.numpadGrid} {...uiProps(uiPath(screen, component, 'container'))}>
      {keys.map((k) => (
        <Pressable
          key={k}
          {...uiProps(uiPath(screen, component, 'key', k))}
          style={({ pressed }) => [
            styles.numpadKey,
            pressed && { backgroundColor: flashColor, opacity: 1 }
          ]}
          onPress={() => {
            logUI(uiPath(screen, component, 'key', k), 'press');
            onPress(k);
          }}
          android_ripple={{ color: flashColor }}
        >
          <Text style={styles.numpadKeyText}>{k}</Text>
        </Pressable>
      ))}
    </View>
  );
}
