/**
 * Supabase client setup.
 * Reads the project URL and anon key from Expo public env variables,
 * and configures storage and URL detection per platform.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    // Web uses the browser's built-in localStorage; native uses AsyncStorage.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web: let the Supabase SDK parse the OAuth callback from the URL automatically.
    // Native: handled manually via Linking / handleDeepLink.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
