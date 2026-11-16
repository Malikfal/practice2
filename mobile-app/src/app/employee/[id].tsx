import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { employeeDetailStyles as styles } from '@/styles/employeeDetailStyles';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function EmployeeDetailScreen() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  
  const { id, firstName, lastName, email, role, position, phone, birthday } = useLocalSearchParams<{
    id: string, firstName: string, lastName: string, email: string, role: string, position: string, phone: string, birthday: string
  }>();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  
  // Стейты для Дня сотрудника
  const [daySegments, setDaySegments] = useState<any[]>([]);
  const [dayTotalSeconds, setDayTotalSeconds] = useState(0);
  const [loadingDay, setLoadingDay] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  const canManage = hasPermission('employees.create_update');
  const canManageProjects = hasPermission('project.members.manage');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const assignRes = await api.get(`/project-assignment-histories/by-user/${id}`);
        setAssignments(assignRes.data.data || assignRes.data || []);

        const today = new Date();
        const fromDate = today.toISOString().split('T')[0];
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const toDate = tomorrow.toISOString().split('T')[0];

        const dayRes = await api.get('/reports/day-timeline', {
          params: { from: fromDate, to: toDate, user_id: id }
        });
        
        const timelineData = dayRes.data.data || dayRes.data || {};
        setDaySegments(timelineData.segments || []);
        setDayTotalSeconds(timelineData.total_seconds || 0);

      } catch (error: any) {
        console.error('Ошибка загрузки данных сотрудника:', error);
      } finally {
        setLoadingAssignments(false);
        setLoadingDay(false);
      }
    };

    if (id) fetchData();
  }, [id]);

  const handleResetPassword = () => {
    const newPassword = Math.random().toString(36).slice(-8);
    
    Alert.alert('Сброс пароля', `Вы уверены? Система установит новый пароль: ${newPassword}`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Сбросить', style: 'destructive', onPress: async () => {
          setIsResetting(true);
          try {
            await api.patch(`/admin/employees/${id}/password`, { 
              password: newPassword,
              password_confirmation: newPassword
            });
            
            Alert.alert('Успех', `Пароль успешно сброшен!\nНовый пароль: ${newPassword}`);
          } catch (error: any) {
            console.error('Ошибка сброса пароля:', error.response?.data);
            Alert.alert('Ошибка', error.response?.data?.message || 'Не удалось сбросить пароль');
          } finally {
            setIsResetting(false);
          }
      }}
    ]);
  };


  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };


  const formatTimestamp = (timestampSeconds: number) => {
    if (!timestampSeconds) return '--:--';
    const date = new Date(timestampSeconds * 1000);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ScrollView style={styles.container}>

      <View style={styles.headerContainer}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{firstName ? firstName[0] : 'U'}</Text>
        </View>
        <Text style={styles.title}>{firstName} {lastName}</Text>
        <Text style={styles.subtitle}>{email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{role || 'Сотрудник'}</Text>
        </View>
      </View>


      <Text style={styles.sectionTitle}>Общие данные</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Должность</Text>
          <Text style={styles.infoValue}>{position || 'Не указана'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Телефон</Text>
          <Text style={styles.infoValue}>{phone || 'Не указан'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Дата рождения</Text>
          <Text style={styles.infoValue}>
            {birthday ? new Date(birthday).toLocaleDateString('ru-RU') : 'Не указана'}
          </Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }]}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{email || 'Не указан'}</Text>
        </View>
        
      </View>


      {canManage && (
        <>
          <Text style={styles.sectionTitle}>Управление доступом</Text>
          <View style={styles.card}>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
              onPress={handleResetPassword}
              disabled={isResetting}
            >
              <Ionicons name="key-outline" size={20} color="#0055ff" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, color: '#333', flex: 1 }}>Сбросить пароль</Text>
              {isResetting && <ActivityIndicator size="small" color="#0055ff" />}
            </TouchableOpacity>
          </View>
        </>
      )}


      <View style={styles.dayHeader}>
        <Text style={styles.sectionTitle}>День сотрудника (Сегодня)</Text>
      </View>
      
      {loadingDay ? (
        <ActivityIndicator size="small" color="#0055ff" style={{ marginBottom: 20 }} />
      ) : (
        <>
          <View style={styles.daySummaryRow}>
            <View style={styles.daySummaryCard}>
              <Text style={styles.daySummaryLabel}>Отработано</Text>
              <Text style={styles.daySummaryValue}>{formatTime(dayTotalSeconds)}</Text>
            </View>
            <View style={styles.daySummaryCard}>
              <Text style={styles.daySummaryLabel}>Сегментов</Text>
              <Text style={styles.daySummaryValue}>{daySegments.length}</Text>
            </View>
          </View>

          {daySegments.length === 0 ? (
            <View style={styles.card}>
              <Text style={{ textAlign: 'center', color: '#999' }}>За сегодня нет отработанных сегментов</Text>
            </View>
          ) : (
            daySegments.map((seg: any, index: number) => (
              <View key={index} style={styles.segmentCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.segmentTime}>
                    {formatTimestamp(seg.started_at)} - {formatTimestamp(seg.ended_at)}
                  </Text>
                  <Text style={styles.segmentInfo}>
                    {seg.project_name} / {seg.task_name}
                  </Text>
                </View>
                <Text style={{ fontWeight: 'bold', color: '#4caf50' }}>
                  {formatTime(seg.duration_seconds || 0)}
                </Text>
              </View>
            ))
          )}
        </>
      )}


      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 15 }}>
        <Text style={styles.sectionTitle}>Проекты сотрудника</Text>
        {canManageProjects && (
          <TouchableOpacity 
            style={{ backgroundColor: '#0055ff', padding: 5, borderRadius: 5 }}
            onPress={() => router.push({ pathname: '/employee/add-assignment', params: { employeeId: id, employeeName: `${firstName} ${lastName}` } })}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {loadingAssignments ? (
        <ActivityIndicator size="small" color="#0055ff" />
      ) : assignments.length === 0 ? (
        <View style={styles.card}>
          <Text style={{ textAlign: 'center', color: '#999' }}>Сотрудник пока не назначен на проекты</Text>
        </View>
      ) : (
        assignments.map((assignment: any) => (
          <View key={assignment.id} style={styles.assignmentCard}>
            <View style={styles.assignmentInfo}>
              <Text style={styles.assignmentTitle}>{assignment.project?.name || 'Проект'}</Text>
              <Text style={styles.assignmentDates}>
                {assignment.started_at ? new Date(assignment.started_at).toLocaleDateString('ru-RU') : '—'} 
                {' — '} 
                {assignment.ended_at ? new Date(assignment.ended_at).toLocaleDateString('ru-RU') : 'По настоящее время'}
              </Text>
            </View>
            <View style={styles.assignmentRole}>
              <Text style={styles.assignmentRoleText}>{assignment.is_pm ? 'Руководитель' : 'Участник'}</Text>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}