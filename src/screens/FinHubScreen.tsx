import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import type { RootStackParamList } from '../navigation';

type HubTile = {
  key: 'findash' | 'fingo' | 'finmed' | 'finven' | 'fincal';
  label: string;
  icon: any;
  onPress: (navigation: NativeStackNavigationProp<RootStackParamList>) => void;
};

const HUB_TILES: HubTile[] = [
  {
    key: 'findash',
    label: 'FinDash',
    icon: require('../../assets/findash.png'),
    onPress: (navigation) => navigation.navigate('Dashboard'),
  },
  {
    key: 'fingo',
    label: 'FinGo',
    icon: require('../../assets/fingo.png'),
    onPress: (navigation) => navigation.navigate('FinGo'),
  },
  {
    key: 'finmed',
    label: 'FinMed',
    icon: require('../../assets/finmeds.png'),
    onPress: (navigation) => navigation.navigate('FinMed'),
  },
  {
    key: 'finven',
    label: 'FinVen',
    icon: require('../../assets/finven.png'),
    onPress: (navigation) => navigation.navigate('FinVen'),
  },
  {
    key: 'fincal',
    label: 'FinCal',
    icon: require('../../assets/FinCal.png'),
    onPress: () => Alert.alert('FinCal', 'FinCal module is coming soon.'),
  },
];

export default function FinHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View testID="finhub.screen.container" style={styles.container}>
      <AppHeader />

      <View testID="finhub.screen.content" style={styles.content}>
        <Text testID="finhub.header.title" style={styles.title}>FinHub</Text>
        <Text testID="finhub.header.subtitle" style={styles.subtitle}>Launch your modules</Text>

        <View testID="finhub.launcher.grid" style={styles.grid}>
          {HUB_TILES.map((tile) => (
            <TouchableOpacity
              key={tile.key}
              testID={`finhub.tile.${tile.key}`}
              style={styles.tile}
              onPress={() => tile.onPress(navigation)}
              activeOpacity={0.85}
            >
              <Image
                testID={`finhub.tile.${tile.key}.icon`}
                source={tile.icon}
                style={styles.tileIcon}
                resizeMode="contain"
              />
              <Text testID={`finhub.tile.${tile.key}.label`} style={styles.tileLabel}>{tile.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'DM Sans',
  },
  subtitle: {
    color: '#8FA8C9',
    marginTop: 4,
    marginBottom: 20,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'DM Sans',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  tile: {
    width: '48%',
    minHeight: 138,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F3A59',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  tileIcon: {
    width: 66,
    height: 66,
    marginBottom: 10,
  },
  tileLabel: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'DM Sans',
  },
});
