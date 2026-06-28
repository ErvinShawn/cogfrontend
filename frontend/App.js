import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';

import MainTabs from './screens/MainTabs';   // ✅ IMPORTANT

import SettingsScreen from './screens/SettingsScreen';
import RoutinesScreen from './screens/RoutinesScreen';
import AlertsScreen from './screens/AlertsScreen';
import ProfileScreen from './screens/ProfileScreen';
import { AlertsProvider } from './context/AlertsContext';
import TopAlertBanner from './components/TopAlertBanner';
import DeviceLinkScreen from './screens/DeviceLinkScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <AlertsProvider>
        <View style={{ flex: 1 }}>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              
              <Stack.Screen name="SignIn" component={SignInScreen} />
              <Stack.Screen name="SignUp" component={SignUpScreen} />

              {/* ✅ Main App */}
              <Stack.Screen name="Main" component={MainTabs} />

              {/* ✅ Secondary Screens */}
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Routines" component={RoutinesScreen} />
              <Stack.Screen name="Alerts" component={AlertsScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="DeviceLink" component={DeviceLinkScreen} />
            </Stack.Navigator>
          </NavigationContainer>
          <TopAlertBanner />
        </View>
      </AlertsProvider>
    </SafeAreaProvider>
  );
}