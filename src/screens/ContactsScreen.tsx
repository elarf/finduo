import React from 'react';
import { View } from 'react-native';
import ContactsSection from '../components/sections/ContactsSection';

export default function ContactsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <ContactsSection />
    </View>
  );
}
