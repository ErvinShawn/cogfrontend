import { View, Text, Image, ScrollView, Pressable } from 'react-native';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles/screens/ProfileScreenStyles';
import {SafeAreaView} from 'react-native-safe-area-context';

const DetailRow = ({ label, value, icon }) => (
  <View style={styles.detailRow}>
    <View style={styles.rowLeft}>
      <Ionicons name={icon} size={18} color="#10B981" />
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <Text style={styles.detailValue}>{value || 'Not available'}</Text>
  </View>
);

export default function ProfileScreen({ route, navigation }) {
  const user = route.params?.user || {};
  const deviceData = route.params?.deviceData || null;

  const deviceState = useMemo(() => {
    if (!deviceData) return 'No linked device';
    if (!deviceData.status) return 'Offline';
    return deviceData.status.charAt(0).toUpperCase() + deviceData.status.slice(1);
  }, [deviceData]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.heroCard}>
          {user.photo ? (
            <Image source={{ uri: user.photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={38} color="#94A3B8" />
            </View>
          )}

          <Text style={styles.name}>{user.name || 'Patient'}</Text>
          <Text style={styles.subText}>{user.condition || 'No condition added'}</Text>

          <Pressable style={styles.editBtn} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="create-outline" size={16} color="#0F172A" />
            <Text style={styles.editBtnText}>Manage Settings</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Profile Details</Text>
        <View style={styles.card}>
          <DetailRow label="Patient ID" value={user.user_id ? String(user.user_id) : '-'} icon="id-card-outline" />
          <View style={styles.divider} />
          <DetailRow label="Status" value={user.activity || 'Active'} icon="pulse-outline" />
          <View style={styles.divider} />
          <DetailRow label="Device Network" value={user.connection || deviceState} icon="wifi-outline" />
          <View style={styles.divider} />
          <DetailRow label="Battery" value={user.battery || '-%'} icon="battery-half-outline" />
          <View style={styles.divider} />
          <DetailRow label="Monitoring Zone" value={user.zone || '-'} icon="shield-checkmark-outline" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
