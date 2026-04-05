import React, { useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
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

function NumpadKey({
  keyValue,
  onPress,
  flashColor,
  screen,
  component
}: {
  keyValue: string;
  onPress: (key: string) => void;
  flashColor: string;
  screen: string;
  component: string;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePressIn = () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Immediately show the color
    fadeAnim.setValue(1);
  };

  const handlePressOut = () => {
    // Fade out over 400ms
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  const backgroundColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#142235', flashColor],
  });

  return (
    <Pressable
      style={{ width: '31%' }}
      {...uiProps(uiPath(screen, component, 'key', keyValue))}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => {
        logUI(uiPath(screen, component, 'key', keyValue), 'press');
        onPress(keyValue);
      }}
      android_ripple={{ color: flashColor }}
    >
      <Animated.View style={[
        {
          backgroundColor,
          borderColor: '#2D486E',
          borderWidth: 1,
          borderRadius: 4,
          paddingVertical: 12,
          alignItems: 'center',
        }
      ]}>
        <Text style={styles.numpadKeyText}>{keyValue}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function NumpadGrid({ keys, onPress, flashColor, screen, component = 'numpad' }: NumpadGridProps) {
  return (
    <View style={styles.numpadGrid} {...uiProps(uiPath(screen, component, 'container'))}>
      {keys.map((k) => (
        <NumpadKey
          key={k}
          keyValue={k}
          onPress={onPress}
          flashColor={flashColor}
          screen={screen}
          component={component}
        />
      ))}
    </View>
  );
}
