import { View, Text, ScrollView, Pressable, Animated, Modal, TextInput, Platform, ActivityIndicator, Alert } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import styles from '../styles/screens/RoutinesScreenStyles';
import { routineService } from '../services/routineService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AnimatedRoutineCard = ({ routine, index, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }).start();
    Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, delay: index * 100, useNativeDriver: true }).start();
  }, [index]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }}>
      {/* ✅ Now fully pressable to open the edit modal */}
      <Pressable style={styles.card} onPress={() => onPress(routine, index)}>
        <View style={styles.timeBlock}><Text style={styles.timeText}>{routine.time}</Text></View>
        <View style={styles.infoBlock}>
          <Text style={styles.routineTitle}>{routine.title}</Text>
          {routine.description ? (
            <Text style={styles.routineDesc} numberOfLines={2}>{routine.description}</Text>
          ) : null}
        </View>
        <Ionicons name="pencil" size={18} color="#CBD5E1" />
      </Pressable>
    </Animated.View>
  );
};

export default function RoutinesScreen() {
  const [routines, setRoutines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  
  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [dateObj, setDateObj] = useState(new Date()); 
  const [newTime, setNewTime] = useState(''); 
  const [showPicker, setShowPicker] = useState(false); 
  const [editingIndex, setEditingIndex] = useState(null); // ✅ Tracks if updating vs adding
  const [userId, setUserId] = useState(null);
  const [deviceId, setDeviceId] = useState("pi_002");
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem("user").then(str => {
      const u = JSON.parse(str);
      const id = u.user_id || u.id;
      setUserId(id);
      setDeviceId(u.device_id || "pi_002"); // add this
    });
  }, []);

  useEffect(() => {
    if (userId) {
      loadRoutines();
    }
  }, [userId]);

  const loadRoutines = async () => {
    try {
      setIsLoading(true);
      const data = await routineService.getUserRoutines(userId); 
      if (data && Array.isArray(data)) setRoutines(data);
      else setRoutines([]);
    } catch (error) {
      setRoutines([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      let hours = selectedDate.getHours();
      let minutes = selectedDate.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12; 
      minutes = minutes < 10 ? '0' + minutes : minutes;
      setNewTime(`${hours}:${minutes} ${ampm}`);
    }
  };

  const openAddModal = () => {
    setEditingIndex(null);
    setNewTitle(''); setNewDesc(''); setNewTime(''); setDateObj(new Date());
    setModalVisible(true);
  };

  const openEditModal = (routine, index) => {
    setEditingIndex(index);
    setNewTitle(routine.title);
    setNewDesc(routine.description || '');
    setNewTime(routine.time);
    setModalVisible(true);
  };

  const handleSaveRoutine = async () => {
    if (!newTitle.trim() || !newTime.trim()) return;
    setIsSaving(true);

    try {
      const stepData = { title: newTitle, description: newDesc, time: newTime };

      if (editingIndex !== null) {
        await routineService.updateReminder(userId, editingIndex, stepData);
      } else {
        await routineService.saveReminder(deviceId, userId, stepData);
      }
      
      await loadRoutines(); // Refresh to ensure sync
      closeAndResetModal();
    } catch (error) {
      Alert.alert("Error", "Could not sync reminder to the cloud.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete Task", "Remove this routine?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await routineService.deleteReminder(userId, editingIndex);
            await loadRoutines();
            closeAndResetModal();
          } catch (e) { Alert.alert("Error", "Could not delete."); }
        } 
      }
    ]);
  };

  const closeAndResetModal = () => {
    setModalVisible(false);
    setEditingIndex(null);
  };

  if (isLoading) return <View style={{flex:1, justifyContent:'center'}}><ActivityIndicator size="large" color="#10B981" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {routines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-clear-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Routines Set</Text>
            <Text style={styles.emptySubtitle}>Tap + to schedule daily tasks for the patient.</Text>
          </View>
        ) : (
          routines.map((routine, i) => (
            <AnimatedRoutineCard 
              key={i} 
              routine={routine} 
              index={i} 
              onPress={openEditModal} 
            />
          ))
        )}
      </ScrollView>

      <Animated.View style={[styles.fabContainer, { transform: [{ scale: buttonScale }] }]}>
        <Pressable 
          style={styles.fab} 
          onPress={openAddModal}
          onPressIn={() => Animated.spring(buttonScale, { toValue: 0.9, useNativeDriver: true }).start()}
          onPressOut={() => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start()}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </Pressable>
      </Animated.View>

      <Modal visible={isModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            
            {/* Modal Header with Delete Icon */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={styles.modalTitle}>{editingIndex !== null ? 'Edit Routine' : 'New Routine'}</Text>
              {editingIndex !== null && (
                <Pressable onPress={confirmDelete}>
                  <Ionicons name="trash-outline" size={24} color="#EF4444" />
                </Pressable>
              )}
            </View>

            <TextInput 
              style={styles.input} 
              placeholder="Task Name (e.g. Medication)" 
              value={newTitle} 
              onChangeText={setNewTitle} 
              placeholderTextColor="#94A3B8"
            />
            
            <Pressable style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowPicker(true)}>
              <Text style={{ color: newTime ? '#1E293B' : '#94A3B8' }}>{newTime || 'Select Time'}</Text>
            </Pressable>
            
            {showPicker && <DateTimePicker value={dateObj} mode="time" onChange={onTimeChange} />}
            
            <TextInput 
              style={[styles.input, styles.textArea]} 
              placeholder="Details (Optional)" 
              value={newDesc} 
              onChangeText={setNewDesc} 
              multiline 
              placeholderTextColor="#94A3B8"
            />

            {/* ✅ FIXED UI: Perfectly proportionate flex buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <Pressable 
                style={{ flex: 1, paddingVertical: 14, backgroundColor: '#F1F5F9', borderRadius: 10, alignItems: 'center', marginRight: 8 }} 
                onPress={closeAndResetModal}
              >
                <Text style={{ color: '#64748B', fontWeight: 'bold' }}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                style={{ flex: 1, paddingVertical: 14, backgroundColor: '#10B981', borderRadius: 10, alignItems: 'center', marginLeft: 8, opacity: isSaving ? 0.7 : 1 }} 
                onPress={handleSaveRoutine} 
                disabled={isSaving}
              >
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{editingIndex !== null ? 'Update' : 'Save'}</Text>}
              </Pressable>
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
}