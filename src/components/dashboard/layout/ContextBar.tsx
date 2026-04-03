import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { uiPath, uiProps } from '../../../lib/devtools';

interface Props {
  label: string;
  onDismiss: () => void;
  rightElement?: React.ReactNode;
}

export default function ContextBar({ label, onDismiss, rightElement }: Props) {
  const slideAnim = useRef(new Animated.Value(-48)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      overshootClamping: true,
      restDisplacementThreshold: 0.1,
      restSpeedThreshold: 0.1,
    }).start();
  }, [slideAnim]);

  return (
    <Animated.View
      style={[s.bar, { transform: [{ translateY: slideAnim }] }]}
      {...uiProps(uiPath('context_bar', 'container', 'view'))}
    >
      <TouchableOpacity
        style={s.labelBtn}
        onPress={onDismiss}
        {...uiProps(uiPath('context_bar', 'label', 'button'))}
      >
        <Text style={s.labelText} {...uiProps(uiPath('context_bar', 'label', 'text'))}>{label}</Text>
        <Text style={s.dismissHint} {...uiProps(uiPath('context_bar', 'label', 'dismiss_hint'))}>↓</Text>
      </TouchableOpacity>
      {rightElement && (
        <View style={s.right} {...uiProps(uiPath('context_bar', 'right_slot', 'view'))}>
          {rightElement}
        </View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#050D1A',
    borderBottomWidth: 1,
    borderBottomColor: '#1F3A59',
    zIndex: 1,
  },
  labelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelText: {
    color: '#53E3A6',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dismissHint: {
    color: '#2A4163',
    fontSize: 14,
  },
  right: {
    zIndex: 2,
  },
});
