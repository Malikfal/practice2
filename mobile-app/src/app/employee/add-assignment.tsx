import api from '@/services/api';
import { createEmployeeStyles as styles } from '@/styles/createEmployeeStyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AddAssignmentScreen() {
  const router = useRouter();
  const { employeeId, employeeName } = useLocalSearchParams<{ employeeId: string, employeeName: string }>();

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/projects');
        const data = response.data.data || response.data || [];
        setProjects(data);
      } catch (error) {
        Alert.alert('Ошибка', 'Не удалось загрузить список проектов');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);


  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) setStartDate(selectedDate);
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setEndDate(selectedDate);
  };

  const formatDateForBackend = (date: Date | null) => {
    if (!date) return undefined;
    return date.toISOString().split('T')[0];
  };

  const formatDateForUI = (date: Date | null) => {
    if (!date) return 'Выберите дату';
    return date.toLocaleDateString('ru-RU');
  };

  const handleSave = async () => {
    if (!selectedProjectId) {
      Alert.alert('Ошибка', 'Выберите проект');
      return;
    }

    setIsSaving(true);
    try {
      await api.post(`/projects/${selectedProjectId}/members`, {
        user_id: employeeId,
        started_at: formatDateForBackend(startDate),
        ended_at: formatDateForBackend(endDate),
      });

      Alert.alert('Успех', `${employeeName} назначен на проект!`);
      router.back();
    } catch (error: any) {
      console.error('Ошибка назначения:', error.response?.data);
      Alert.alert('Ошибка', error.response?.data?.message || 'Не удалось назначить сотрудника');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Новое назначение</Text>

      <Text style={styles.label}>Сотрудник</Text>
      <TextInput style={[styles.input, { backgroundColor: '#f0f0f0', color: '#666' }]} value={employeeName} editable={false} />

      <Text style={styles.label}>Проект *</Text>
      <View style={{ marginBottom: 20 }}>
        {projects.length === 0 ? (
          <Text style={{ color: '#999' }}>Нет доступных проектов</Text>
        ) : (
          projects.map((proj) => (
            <TouchableOpacity 
              key={proj.id}
              style={{ 
                padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1,
                borderColor: selectedProjectId === proj.id ? '#0055ff' : '#ddd',
                backgroundColor: selectedProjectId === proj.id ? '#e0e7ff' : '#fff'
              }}
              onPress={() => setSelectedProjectId(proj.id)}
            >
              <Text style={{ fontWeight: selectedProjectId === proj.id ? 'bold' : 'normal', color: '#333' }}>
                {proj.name}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Text style={styles.label}>Дата начала</Text>
      <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowStartPicker(true)}>
        <Text style={{ color: startDate ? '#333' : '#999', fontSize: 16 }}>{formatDateForUI(startDate)}</Text>
      </TouchableOpacity>

      {showStartPicker && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display="default"
          onChange={onStartDateChange}
        />
      )}

      <Text style={styles.label}>Дата окончания</Text>
      <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowEndPicker(true)}>
        <Text style={{ color: endDate ? '#333' : '#999', fontSize: 16 }}>{formatDateForUI(endDate)}</Text>
      </TouchableOpacity>

      {showEndPicker && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display="default"
          onChange={onEndDateChange}
          minimumDate={startDate || undefined}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Сохранить</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}