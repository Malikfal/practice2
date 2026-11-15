import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { taskStyles as styles } from '@/styles/taskStyles';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';

export default function ProjectTasksScreen() {
  const { id, name } = useLocalSearchParams<{ id: string, name: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [projectRes, tasksRes, columnsRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/tasks`),
        api.get(`/projects/${id}/task-status-columns`)
      ]);
      
      const projectData = projectRes.data.project || projectRes.data.data || projectRes.data;
      setProject(projectData);
            
      const tasksData = tasksRes.data.data || tasksRes.data || [];
      setTasks(tasksData);
      
      const columnsData = columnsRes.data.data || columnsRes.data || [];
      setColumns(columnsData);

    } catch (error: any) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (id) fetchData();
    }, [id])
  );

  const changeProjectStatus = async (newStatus: string) => {
    try {
      await api.patch(`/projects/${id}`, { name: project.name, status: newStatus });
      fetchData(); 
    } catch (error: any) {
      Alert.alert('Ошибка', error.response?.data?.message || 'Не удалось изменить статус проекта');
    }
  };

  const moveTask = async (taskItem: any, columnId: string) => {
    try {
      await api.patch(`/projects/${id}/tasks/${taskItem.id}/move`, { 
        status_column_id: columnId,
        destination_index: 0
      });
      fetchData(); 
    } catch (error: any) {
      console.error('Ошибка перемещения задачи:', error.response?.data);
      Alert.alert('Ошибка', 'Не удалось переместить задачу');
    }
  };

  const stripHtml = (html: string) => {
    if (!html) return 'Описание отсутствует';
    return html.replace(/<[^>]+>/g, '');
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  const canManageMembers = hasPermission('project.members.manage');
  const canManageProject = hasPermission('projects.create_update');
  const canCreateTask = hasPermission('tasks.create_update');

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>{name || 'Проект'}</Text>
      
      <Text style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>
        {stripHtml(project?.description)}
      </Text>

        {canManageProject && (
            <View style={{ flexDirection: 'row', gap: 5, marginBottom: 20 }}>
                {['ACTIVE', 'ARCHIVED'].map((s) => (
                <TouchableOpacity 
                    key={s} 
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: project?.status === s ? '#0055ff' : '#e0e0e0' }}
                    onPress={() => changeProjectStatus(s)}
                >
                    <Text style={{ fontSize: 12, color: project?.status === s ? '#fff' : '#333', fontWeight: 'bold' }}>{s}</Text>
                </TouchableOpacity>
                ))}
            </View>
        )}
      

      <View style={styles.membersContainer}>
        <View style={styles.membersHeader}>
          <Text style={styles.membersTitle}>Команда проекта</Text>
          {canManageMembers && (
            <TouchableOpacity 
              style={styles.addMemberButton}
              onPress={() => {
                router.push({ pathname: '/project/add-member', params: { projectId: id } });
              }}
            >
              <Ionicons name="person-add" size={20} color="#0055ff" />
            </TouchableOpacity>
          )}
        </View>
        
        {project?.members && project.members.length > 0 ? (
          <View style={styles.membersList}>
            {project.members.map((member: any) => {
              const firstName = member.first_name || member.user?.first_name || '';
              const fallbackName = member.name || member.user?.name || member.email || 'U';
              const displayLetter = firstName ? firstName[0] : fallbackName[0];

              return (
                <View key={member.id} style={styles.memberAvatar}>
                  <Text style={styles.memberText}>
                    {displayLetter.toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.noMembersText}>В проекте пока нет назначенных сотрудников</Text>
        )}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.taskCard}>
            <TouchableOpacity 
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.id, projectId: id } })}
            >
              <View style={[styles.statusDot, { backgroundColor: item.status_color || '#2196f3' }]} />
              
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{item.title || item.name}</Text>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {columns.map(col => (
                    <TouchableOpacity 
                      key={col.id}
                      style={{ 
                        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
                        backgroundColor: item.status_column_id === col.id ? (item.status_color || '#0055ff') : '#eee'
                      }}
                      onPress={() => moveTask(item, col.id)}
                    >
                      <Text style={{ fontSize: 10, color: item.status_column_id === col.id ? '#fff' : '#333', fontWeight: 'bold' }}>
                        {col.label || col.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={20} color="#ccc" style={{ marginLeft: 10 }} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="documents-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>В этом проекте пока нет задач</Text>
          </View>
        }
      />

        {canCreateTask && (
            <TouchableOpacity 
                style={{
                position: 'absolute', bottom: 30, right: 20, backgroundColor: '#0055ff',
                width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center',
                elevation: 5,
                }}
                onPress={() => router.push({ pathname: '/create-task', params: { projectId: id, projectName: name } })}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>
        )}
      
    </View>
  );
}