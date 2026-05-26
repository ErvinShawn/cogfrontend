import { View, Text, ScrollView, Pressable, Animated, Image, Modal, TextInput, Alert, ActivityIndicator } from 'react-native'
import { useEffect, useState, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import styles from '../styles/screens/KnownScreenStyles'
import { API_BASE_URL } from '../config'
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = API_BASE_URL
const CLOUD_NAME = "diq0bcrjl"
const UPLOAD_PRESET = "Test_Preset"


// ---------- Animated Person Card ----------
const AnimatedPersonCard = ({ person, index, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(20)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      delay: index * 100,
      useNativeDriver: true
    }).start()

    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 7,
      delay: index * 100,
      useNativeDriver: true
    }).start()
  }, [index])

  const primaryImage = person.images?.[0]

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
      }}
    >
      <Pressable style={styles.card} onPress={() => onPress(person)}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{person.name.charAt(0)}</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.relation}>{person.relation}</Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}


// ---------- Screen ----------
export default function KnownScreen() {

  const [people, setPeople] = useState([])
  const [isModalVisible, setModalVisible] = useState(false)
  const [editingPersonId, setEditingPersonId] = useState(null)
  const [tempImages, setTempImages] = useState([])
  const [newName, setNewName] = useState("")
  const [newRelation, setNewRelation] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [userId, setUserId] = useState(null);


  // ---------- Load faces from backend ----------
  useEffect(() => {
    fetchFaces()
  }, [])

  const fetchFaces = async () => {
    try {
      const userString = await AsyncStorage.getItem("user");
      const user = JSON.parse(userString);
      const id = user.user_id || user.id;
      setUserId(id);

      const res = await fetch(`${API_BASE}/faces/user/${id}`);
      const data = await res.json();
      setPeople(
        data.map(face => ({
          id: face.id.toString(),
          name: face.person_name,
          relation: face.relationship,
          images: face.image_urls || []   // was face.image_url
        }))
      );
    } catch (err) {
      console.log("Fetch faces error:", err);
    }
  };

  // ---------- Image Picker ----------
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission required", "Please allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,   // re-enable now that we want multiple
      quality: 0.8,
    });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setTempImages(prev => [...prev, ...uris]);
    }
  };

  // ---------- Save Person — send image_urls array ----------
  const savePerson = async () => {
    if (!newName || !newRelation || tempImages.length === 0) {
      Alert.alert("Please fill all fields and add at least one photo");
      return;
    }

    setIsUploading(true);

    try {
      // Upload any local images (not already on cloudinary)
      const uploadedUrls = await Promise.all(
        tempImages.map(uri =>
          uri.startsWith("http") ? uri : uploadToCloudinary(uri)
        )
      );

      const payload = {
        person_name: newName,
        relationship: newRelation,
        image_urls: uploadedUrls,   // array now
        user_id: userId
      };

      let res;
      if (editingPersonId) {
        res = await fetch(`${API_BASE}/faces/${editingPersonId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE}/faces`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) throw new Error("Server error");
      await fetchFaces();
      closeModal();
    } catch (err) {
      console.log(err);
      Alert.alert("Upload failed", "Could not save person data.");
    } finally {
      setIsUploading(false);
    }
  };


  // ---------- Cloudinary Upload ----------
  const uploadToCloudinary = async (uri) => {
    const formData = new FormData()

    formData.append("file", {
      uri,
      type: "image/jpeg",
      name: "upload.jpg"
    })

    formData.append("upload_preset", UPLOAD_PRESET)

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    )

    const json = await res.json()
    if (!json.secure_url) throw new Error("Cloudinary upload failed")

    return json.secure_url
  }



  // ---------- Delete ----------
  const confirmDeletePerson = () => {
    if (!editingPersonId) return

    Alert.alert("Delete Person", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${API_BASE}/faces/${editingPersonId}`, {
              method: "DELETE"
            })
            await fetchFaces()
            closeModal()
          } catch (err) {
            console.log(err)
          }
        }
      }
    ])
  }


  // ---------- Modal Helpers ----------
  const openAddModal = () => {
    setEditingPersonId(null)
    setNewName("")
    setNewRelation("")
    setTempImages([])
    setModalVisible(true)
  }

  const openEditModal = (person) => {
    setEditingPersonId(person.id)
    setNewName(person.name)
    setNewRelation(person.relation)
    setTempImages(person.images || [])
    setModalVisible(true)
  }

  const closeModal = () => {
    setModalVisible(false)
    setTempImages([])
    setEditingPersonId(null)
    setIsUploading(false)
  }


  // ---------- UI ----------
  return (
    <View style={styles.container}>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Recognized Faces</Text>
        <Text style={styles.headerSubtitle}>
          People Cognia can identify for the patient.
        </Text>

        {people.map((person, i) => (
          <AnimatedPersonCard
            key={person.id}
            person={person}
            index={i}
            onPress={openEditModal}
          />
        ))}
      </ScrollView>


      {/* Floating Add Button */}
      <Pressable style={styles.fab} onPress={openAddModal}>
        <Ionicons name="camera" size={24} color="#FFF" />
        <Text style={styles.fabText}>Add Person</Text>
      </Pressable>


      {/* ---------- Modal ---------- */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPersonId ? "Edit Details" : "Add Details"}
              </Text>

              {editingPersonId && (
                <Pressable onPress={confirmDeletePerson}>
                  <Ionicons name="trash-outline" size={24} color="#EF4444" />
                </Pressable>
              )}
            </View>

            {/* Image Upload */}
            {tempImages.length === 0 ? (
              <Pressable style={styles.emptyImageUpload} onPress={pickImages}>
                <Ionicons name="images-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyImageUploadText}>Tap to add photos (multiple angles)</Text>
              </Pressable>
            ) : (
              <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {tempImages.map((uri, i) => (
                    <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                      <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                      <Pressable
                        onPress={() => setTempImages(prev => prev.filter((_, idx) => idx !== i))}
                        style={{
                          position: 'absolute', top: -6, right: -6,
                          backgroundColor: '#EF4444', borderRadius: 10,
                          width: 20, height: 20, alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={pickImages}
                    style={{
                      width: 80, height: 80, borderRadius: 8,
                      backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <Ionicons name="add" size={28} color="#94A3B8" />
                  </Pressable>
                </ScrollView>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>
                  {tempImages.length} photo{tempImages.length > 1 ? 's' : ''} — add different angles for better recognition
                </Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Name"
              value={newName}
              onChangeText={setNewName}
            />

            <TextInput
              style={styles.input}
              placeholder="Relationship"
              value={newRelation}
              onChangeText={setNewRelation}
            />

            {isUploading && (
              <ActivityIndicator size="small" color="#000" />
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeModal}>
                <Text>Cancel</Text>
              </Pressable>

              <Pressable style={styles.saveBtn} onPress={savePerson}>
                <Text style={styles.saveBtnText}>
                  {editingPersonId ? "Update" : "Save"}
                </Text>
              </Pressable>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  )
}