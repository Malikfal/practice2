import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { taskDetailStyles as styles } from '@/styles/taskDetailStyles';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function TaskDetailScreen() {
  const { id: taskId, projectId } = useLocalSearchParams<{ id: string, projectId: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  
  const [task, setTask] = useState<any>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [taskRes, columnsRes] = await Promise.all([
        api.get(`/projects/${projectId}/tasks/${taskId}`),
        api.get(`/projects/${projectId}/task-status-columns`)
      ]);
      setTask(taskRes.data.data || taskRes.data);
      setColumns(columnsRes.data.data || columnsRes.data || []);
    } catch (error) {
      console.error('Ошибка при загрузке:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId && projectId) fetchData();
  }, [taskId, projectId]);

  const handleDeleteTask = () => {
    Alert.alert('Удаление', 'Вы уверены, что хотите удалить задачу?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/projects/${projectId}/tasks/${taskId}`);
            router.back();
          } catch (e) {
            Alert.alert('Ошибка', 'Не удалось удалить задачу');
          }
      }}
    ]);
  };

  const updatePriority = async (newPriority: string | null) => {
    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}`, { 
        title: task.title,
        description: task.description || '',
        priority: newPriority
      });
      fetchData();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось изменить приоритет');
    }
  };

  const moveTask = async (columnId: string) => {
    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}/move`, { 
        status_column_id: columnId,
        destination_index: 0
      });
      fetchData();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Ошибка', 'Не удалось переместить задачу');
    }
  };

  const stripHtml = (html: string) => {
    if (!html) return 'Описание отсутствует';
    return html.replace(/<[^>]+>/g, '');
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  if (!task) return <Text style={{ textAlign: 'center', marginTop: 50 }}>Задача не найдена</Text>;

  const priorityOptions = [
    { label: 'Без приоритета', value: null },
    { label: 'Низкий', value: 'LOW' },
    { label: 'Средний', value: 'MEDIUM' },
    { label: 'Высокий', value: 'HIGH' }
  ];

  const canEditTask = hasPermission('tasks.create_update');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{task.title || task.name}</Text>
        
        {canEditTask && (
            <>
                <Text style={styles.sectionTitle}>Статус задачи</Text>
                <View style={{ flexDirection: 'row', gap: 5, marginBottom: 20, flexWrap: 'wrap' }}>
                {columns.map((col) => (
                    <TouchableOpacity 
                    key={col.id} 
                    style={{ padding: 8, borderRadius: 8, backgroundColor: task.status_column_id === col.id ? (task.status_color || '#4caf50') : '#eee' }}
                    onPress={() => moveTask(col.id)}
                    >
                    <Text style={{ fontSize: 12, color: task.status_column_id === col.id ? '#fff' : '#333' }}>{col.label || col.name}</Text>
                    </TouchableOpacity>
                ))}
                </View>

                <Text style={styles.sectionTitle}>Приоритет</Text>
                <View style={{ flexDirection: 'row', gap: 5, marginBottom: 20, flexWrap: 'wrap' }}>
                {priorityOptions.map((opt) => (
                    <TouchableOpacity 
                    key={opt.label} 
                    style={{ padding: 8, borderRadius: 8, backgroundColor: task.priority === opt.value ? '#0055ff' : '#eee' }}
                    onPress={() => updatePriority(opt.value)}
                    >
                    <Text style={{ fontSize: 12, color: task.priority === opt.value ? '#fff' : '#333' }}>{opt.label}</Text>
                    </TouchableOpacity>
                ))}
                </View>
            </>
        )}
        

        <Text style={styles.sectionTitle}>Описание</Text>
        <Text style={styles.description}>{stripHtml(task.description)}</Text>

        {canEditTask && (
          <>
            <View style={{ borderTopWidth: 1, borderTopColor: '#eee', marginVertical: 20 }} />
            <TouchableOpacity 
              style={{ backgroundColor: '#ff4444', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 }}
              onPress={handleDeleteTask}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', marginTop: 5 }}>Удалить задачу</Text>
            </TouchableOpacity>
          </>
        )}

      </View>
    </ScrollView>
  );
}