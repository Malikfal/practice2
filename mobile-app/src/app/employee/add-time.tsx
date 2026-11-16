import api from '@/services/api';
import { createEmployeeStyles as styles } from '@/styles/createEmployeeStyles';
import dayjs from 'dayjs';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker from 'react-native-ui-datepicker';

export default function AddTimeScreen() {
  const router = useRouter();
  const { employeeId, employeeName } = useLocalSearchParams<{ employeeId: string, employeeName: string }>();

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  
  const [startDate, setStartDate] = useState(dayjs().subtract(1, 'hour'));
  const [endDate, setEndDate] = useState(dayjs());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Загружаем проекты при старте
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/projects');
        setProjects(response.data.data || response.data || []);
      } catch (error) {
        Alert.alert('Ошибка', 'Не удалось загрузить проекты');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // Загружаем задачи при выборе проекта
  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      setSelectedTaskId(null);
      return;
    }

    const fetchTasks = async () => {
      setLoadingTasks(true);
      try {
        const response = await api.get(`/projects/${selectedProjectId}/tasks`);
        const data = response.data.data || response.data || [];
        setTasks(data);
        setSelectedTaskId(null);
      } catch (error) {
        console.error('Ошибка загрузки задач:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить задачи для этого проекта');
      } finally {
        setLoadingTasks(false);
      }
    };

    fetchTasks();
  }, [selectedProjectId]);

  const handleSave = async () => {
    if (!selectedProjectId) {
      Alert.alert('Ошибка', 'Выберите проект');
      return;
    }
    if (!selectedTaskId) {
      Alert.alert('Ошибка', 'Выберите задачу');
      return;
    }
    if (endDate.isAfter(dayjs())) {
      Alert.alert('Ошибка', 'Время окончания не может быть в будущем');
      return;
    }


    const selectedTask = tasks.find(t => t.id === selectedTaskId);
    if (!selectedTask) return;

    setIsSaving(true);
    try {
      await api.post('/time-entries', {
        user_id: employeeId,
        project_id: selectedProjectId,
        task_id: null, 
        new_task_title: selectedTask.title || selectedTask.name,
        started_at: startDate.unix(),
        ended_at: endDate.unix(),
        note: note || null,
      });

      Alert.alert('Успех', 'Время успешно добавлено!');
      router.back();
    } catch (error: any) {
      console.error('Ошибка добавления времени:', error.response?.data);
      Alert.alert('Ошибка', error.response?.data?.message || 'Не удалось добавить время');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Добавить время вручную</Text>
      <Text style={{ color: '#666', marginBottom: 20 }}>Сотрудник: {employeeName}</Text>

      {/* ВЫБОР ПРОЕКТА */}
      <Text style={styles.label}>Проект *</Text>
      <View style={{ marginBottom: 20, maxHeight: 200 }}>
        <ScrollView nestedScrollEnabled>
          {projects.map((proj) => (
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
          ))}
        </ScrollView>
      </View>

      {/* ВЫБОР ЗАДАЧИ (появляется, если выбран проект) */}
      {selectedProjectId && (
        <>
          <Text style={styles.label}>Задача *</Text>
          <View style={{ marginBottom: 20, maxHeight: 200 }}>
            {loadingTasks ? (
              <ActivityIndicator size="small" color="#0055ff" style={{ marginVertical: 10 }} />
            ) : tasks.length === 0 ? (
              <Text style={{ color: '#ff4444', fontSize: 14 }}>В этом проекте нет задач. Сначала создайте задачу.</Text>
            ) : (
              <ScrollView nestedScrollEnabled>
                {tasks.map((task) => (
                  <TouchableOpacity 
                    key={task.id}
                    style={{ 
                      padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1,
                      borderColor: selectedTaskId === task.id ? '#0055ff' : '#ddd',
                      backgroundColor: selectedTaskId === task.id ? '#e0e7ff' : '#fff',
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}
                    onPress={() => setSelectedTaskId(task.id)}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: task.status_color || '#ccc', marginRight: 10 }} />
                    <Text style={{ fontWeight: selectedTaskId === task.id ? 'bold' : 'normal', color: '#333', flex: 1 }}>
                      {task.title || task.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </>
      )}

      {/* ВЫБОР ВРЕМЕНИ */}
      <Text style={styles.label}>Начало *</Text>
      <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowStartPicker(true)}>
        <Text style={{ color: '#333', fontSize: 16 }}>{startDate.format('DD.MM.YYYY HH:mm')}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Окончание *</Text>
      <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowEndPicker(true)}>
        <Text style={{ color: '#333', fontSize: 16 }}>{endDate.format('DD.MM.YYYY HH:mm')}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Комментарий</Text>
      <TextInput 
        style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
        value={note} 
        onChangeText={setNote} 
        placeholder="Что было сделано?" 
        multiline
      />

      <TouchableOpacity 
        style={[styles.button, (!selectedTaskId || tasks.length === 0) && { backgroundColor: '#ccc' }]} 
        onPress={handleSave} 
        disabled={isSaving || !selectedTaskId}
      >
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Добавить время</Text>}
      </TouchableOpacity>

      {/* МОДАЛКА НАЧАЛА */}
      <Modal visible={showStartPicker} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <DateTimePicker
              date={startDate.toDate()}
              timePicker={true}
              maxDate={dayjs().toDate()}
              onChange={(params) => {
                if (params.date) setStartDate(dayjs(params.date));
              }}
            />
            <TouchableOpacity 
              style={{ backgroundColor: '#0055ff', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 }}
              onPress={() => setShowStartPicker(false)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* МОДАЛКА ОКОНЧАНИЯ */}
      <Modal visible={showEndPicker} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <DateTimePicker
              date={endDate.toDate()}
              timePicker={true}
              maxDate={dayjs().toDate()}
              onChange={(params) => {
                if (params.date) setEndDate(dayjs(params.date));
              }}
            />
            <TouchableOpacity 
              style={{ backgroundColor: '#0055ff', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 }}
              onPress={() => setShowEndPicker(false)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}