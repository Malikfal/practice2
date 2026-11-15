import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { projectsStyles as styles } from '@/styles/projectsStyles';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

export default function ProjectsScreen() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      const data = response.data.data || response.data || [];
      setProjects(data);
    } catch (err: any) {
      console.error('Ошибка при получении проектов:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProjects();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProjects();
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  const canCreateProject = hasPermission('projects.create_update');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
          <Text style={styles.title}>Мои проекты</Text>
          {canCreateProject && (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => router.push('/create-project')}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      
      <FlatList
        data={projects}
        keyExtractor={(item: any) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => {
              router.push({
                pathname: '/project/[id]',
                params: { id: item.id, name: item.name }
              });
            }}
          > 
            <View style={styles.iconContainer}>
              <Ionicons name="folder-open" size={24} color="#0055ff" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.projectName}>{item.name}</Text>
              <Text style={styles.projectStatus}>Статус: {item.status || 'Активен'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Здесь пока нет проектов</Text>
          </View>
        }
      />
    </View>
  );
}