import api from '@/services/api';
import { homeStyles as styles } from '@/styles/homeStyles';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const fetchDashboardData = async () => {
    try {
      const profileRes = await api.get('/profile');
      const currentUser = profileRes.data.data || profileRes.data;
      setUserData(currentUser);

      const fromDate = selectedDate.toISOString().split('T')[0];
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const toDate = nextDay.toISOString().split('T')[0];

      const [boardRes, timelineRes] = await Promise.all([
        api.get('/tasks/board'),
        api.get('/reports/day-timeline', { 
          params: { from: fromDate, to: toDate, user_id: currentUser.id } 
        }) 
      ]);

      const boardData = boardRes.data.data || boardRes.data || [];
      let allTasks: any[] = [];
      if (Array.isArray(boardData)) {
        boardData.forEach((col: any) => {
          if (col.tasks && Array.isArray(col.tasks)) allTasks = [...allTasks, ...col.tasks];
        });
      } else if (boardData.tasks) {
         allTasks = boardData.tasks;
      }
      setTasks(allTasks);

      const timelineData = timelineRes.data.data || timelineRes.data || {};
      setSegments(timelineData.segments || []);
      setTotalSeconds(timelineData.total_seconds || 0);

    } catch (error: any) {
      console.error('Ошибка загрузки дашборда:', error.response?.data || error.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Добавляем selectedDate в зависимости, чтобы данные перезапрашивались при смене даты
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [selectedDate])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Обработчик выбора даты
  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) setSelectedDate(date);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0055ff" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={tasks}
      keyExtractor={(item) => item.id.toString()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Добро пожаловать 👋</Text>
              <Text style={styles.userName}>{userData?.name || 'Пользователь'}</Text>
            </View>
            <View style={styles.avatar}>
              <Ionicons name="person" size={30} color="#0055ff" />
            </View>
          </View>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Отработано</Text>
              <Text style={styles.summaryValue}>{formatTime(totalSeconds)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Сегментов</Text>
              <Text style={styles.summaryValue}>{segments.length}</Text>
            </View>
          </View>

          {/* Заголовок "Мой день" с кнопкой выбора даты */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 15 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 0 }]}>Мой день</Text>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, elevation: 1, borderWidth: 1, borderColor: '#eee' }}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color="#0055ff" style={{ marginRight: 5 }} />
              <Text style={{ color: '#0055ff', fontWeight: 'bold', fontSize: 14 }}>
                {selectedDate.toLocaleDateString('ru-RU')}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}

          {segments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={40} color="#ccc" />
              <Text style={styles.emptyText}>За этот день нет отработанных сегментов</Text>
            </View>
          ) : (
            segments.map((seg: any, index: number) => {
              const formatTimestamp = (timestampSeconds: number) => {
                if (!timestampSeconds) return '--:--';
                const date = new Date(timestampSeconds * 1000);
                return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
              };

              return (
                <View key={index} style={styles.segmentCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.segmentTime}>
                      {formatTimestamp(seg.started_at)} - {formatTimestamp(seg.ended_at)}
                    </Text>
                    <Text style={styles.segmentInfo}>
                      {seg.project_name} / {seg.task_name}
                    </Text>
                    
                    {seg.note ? (
                      <Text style={{ fontSize: 12, color: '#999', marginTop: 4, fontStyle: 'italic' }}>
                        {seg.note}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontWeight: 'bold', color: '#4caf50', fontSize: 16 }}>
                    {formatTime(seg.duration_seconds || 0)}
                  </Text>
                </View>
              );
            })
          )}

          <Text style={styles.sectionTitle}>Мои задачи</Text>
        </>
      }
      renderItem={({ item }) => (
        <TouchableOpacity 
          style={styles.taskCard}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.id, projectId: item.project_id } })}
        >
          <View style={[styles.statusDot, { backgroundColor: item.status_color || '#2196f3' }]} />
          <View style={styles.taskInfo}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <Text style={styles.projectName}>{item.project_name || 'Проект'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-done-circle-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>У вас пока нет активных задач</Text>
        </View>
      }
    />
  );
}