import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

import HomeScreen from './HomeScreen';
import GeofenceScreen from './GeofenceScreen';
import KnownScreen from './KnownScreen';
import RoutinesScreen from './RoutinesScreen'; // ✅ Swapped Alerts for Routines
import SettingsScreen from './SettingsScreen';
import AppBar from '../components/AppBar';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // Inject our slim custom AppBar here
        header: ({ options }) => (
          <AppBar
            title={options.title || route.name}
            topOffset={route.name === 'Home' ? 6 : 12}
          />
        ),

        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#64748B',

        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          elevation: 0,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          marginBottom: 10,
        },

        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Inter',
          fontWeight: '500',
        },

        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'Home') iconName = 'grid';
          else if (route.name === 'Geofence') iconName = 'location';
          else if (route.name === 'Known') iconName = 'people';
          else if (route.name === 'Routines') iconName = 'calendar';
          else if (route.name === 'Settings') iconName = 'settings';

          const isFocused = color === Colors.primary;
          const finalIconName = isFocused
            ? iconName
            : `${iconName}-outline`;

          return (
            <Ionicons
              name={finalIconName}
              size={22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Cognia Control' }}
      />

      <Tab.Screen
        name="Geofence"
        component={GeofenceScreen}
        options={{ title: 'Safety Zones' }}
      />

      <Tab.Screen
        name="Known"
        component={KnownScreen}
        options={{ title: 'Known People' }}
      />

      <Tab.Screen
        name="Routines"
        component={RoutinesScreen}
        options={{ title: 'Daily Routines' }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Configuration' }}
      />
    </Tab.Navigator>
  );
}