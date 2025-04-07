import React, { useState, useCallback, useEffect } from 'react';
import { FlatList, View, RefreshControl, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, Divider, Button } from '@rneui/themed';
import { getBrewSuggestions, Brew } from '../../../lib/openai';

// Storage keys
const BREWS_STORAGE_KEY = '@GoodCup:brews';

// Helper function to format seconds into MM:SS (same as in HomeScreen)
const formatTime = (totalSeconds: number): string => {
  if (!totalSeconds || isNaN(totalSeconds)) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// Helper to format date
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

export default function BrewsScreen() {
  const params = useLocalSearchParams<{ beanName?: string }>();
  const beanNameFilter = params.beanName;
  const navigation = useNavigation();

  const [allBrews, setAllBrews] = useState<Brew[]>([]);
  const [filteredBrews, setFilteredBrews] = useState<Brew[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // const router = useRouter();
  
  // Suggestion modal state
  const [suggestionModalVisible, setSuggestionModalVisible] = useState(false);
  const [selectedBrew, setSelectedBrew] = useState<Brew | null>(null);
  const [suggestion, setSuggestion] = useState<string>('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  // Effect to update header title
  useEffect(() => {
    if (beanNameFilter) {
      navigation.setOptions({ title: beanNameFilter });
    }
  }, [beanNameFilter, navigation]);

  // Simplified filter function
  const applyFilter = useCallback((brewsToFilter: Brew[]) => {
    console.log("[ApplyFilter] Filtering for bean:", beanNameFilter);
    let result = brewsToFilter;
    if (beanNameFilter) {
      result = result.filter(brew => brew.beanName === beanNameFilter);
    }
    result.sort((a, b) => b.timestamp - a.timestamp);
    setFilteredBrews(result);
  }, [beanNameFilter]);

  const loadBrews = useCallback(async () => {
    setRefreshing(true);
    try {
      const storedBrews = await AsyncStorage.getItem(BREWS_STORAGE_KEY);
      if (storedBrews !== null) {
        const parsedBrews: Brew[] = JSON.parse(storedBrews);
        const fixedBrews = parsedBrews.map(brew => ({ ...brew, beanName: brew.beanName || 'Unnamed Bean' }));
        
        setAllBrews(fixedBrews);

        console.log("[LoadBrews] Applying filter for:", beanNameFilter);
        applyFilter(fixedBrews);
      } else {
        setAllBrews([]);
        setFilteredBrews([]);
      }
    } catch (e) {
      console.error('Failed to load brews.', e);
      setAllBrews([]);
      setFilteredBrews([]);
    } finally {
      setRefreshing(false);
    }
  }, [beanNameFilter, applyFilter]);

  // Get suggestions for a brew
  const fetchSuggestion = async (brew: Brew) => {
    setSelectedBrew(brew);
    setSuggestion('');
    setSuggestionModalVisible(true);
    setLoadingSuggestion(true);
    
    try {
      // Get related brews with same bean
      const relatedBrews = allBrews.filter(b => b.beanName === brew.beanName && b.id !== brew.id);
      
      // Get suggestion from OpenAI
      const suggestion = await getBrewSuggestions(brew, relatedBrews, brew.beanName);
      setSuggestion(suggestion);
    } catch (error) {
      console.error('Error getting suggestion:', error);
      setSuggestion('Error getting suggestion. Please try again later.');
    } finally {
      setLoadingSuggestion(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBrews();
    }, [loadBrews])
  );

  const handleBrewPress = (brew: Brew) => {
    // Show brew details modal and get suggestions
    fetchSuggestion(brew);
  };

  const renderBrewItem = ({ item }: { item: Brew }) => (
    <TouchableOpacity onPress={() => handleBrewPress(item)} activeOpacity={0.7}>
      <Card containerStyle={{ 
        borderRadius: 10, 
        marginBottom: 12,
        padding: 16,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2 
      }}>
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          marginBottom: 8 
        }}>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: '500', 
            color: '#666' 
          }}>
            {formatDate(item.timestamp)}
          </Text>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: '600', 
            color: '#333' 
          }}>
            {item.rating}/10
          </Text>
        </View>
        
        <Divider style={{ 
          marginBottom: 12, 
          backgroundColor: '#e1e1e1' 
        }} />
        
        <Text style={{ 
          fontSize: 14, 
          color: '#666', 
          marginBottom: 4 
        }}>
          Steep time: {formatTime(item.steepTime)}
        </Text>
        
        <Text style={{ 
          fontSize: 14, 
          color: '#666', 
          marginBottom: 4 
        }}>
          Grind: {item.grindSize || 'Not specified'}
        </Text>
        
        <Text style={{ 
          fontSize: 14, 
          color: '#666', 
          marginBottom: 4 
        }}>
          Temp: {item.waterTemp || 'Not specified'}
        </Text>
        
        {item.useBloom && (
          <Text style={{ 
            fontSize: 14, 
            color: '#666', 
            marginBottom: 4 
          }}>
            Bloom: {item.bloomTime || 'Yes'}
          </Text>
        )}
        
        {item.notes && (
          <>
            <Divider style={{ 
              marginVertical: 8, 
              backgroundColor: '#e1e1e1' 
            }} />
            <Text style={{ 
              fontSize: 14, 
              color: '#666', 
              fontStyle: 'italic' 
            }}>
              {item.notes}
            </Text>
          </>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' /* White */ }} className="dark:bg-black" edges={['top', 'left', 'right']}>
      {/* Keep generic title in _layout.tsx, this useEffect will override it */}
      {/* <Stack.Screen options={{ title: beanNameFilter || 'Brews' }} /> */}
      <View style={{ flex: 1 }} className="bg-white dark:bg-black">
        {/* Removed Filter Dropdown Card */}

        {/* Use FlatList directly with filteredBrews */}
        <FlatList
          data={filteredBrews}
          renderItem={renderBrewItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 64 }}>
              <Text style={{ fontSize: 16, color: '#888', textAlign: 'center' }}>
                {refreshing ? 'Loading...' : `No brews found for ${beanNameFilter || 'this bean'}`}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadBrews} />
          }
          contentContainerStyle={{ 
            paddingHorizontal: 12, 
            paddingTop: 12,
            paddingBottom: 40 
          }}
        />
      </View>

      {/* Suggestion Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={suggestionModalVisible}
        onRequestClose={() => setSuggestionModalVisible(false)}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)'
        }}>
          <View style={{
            width: '90%',
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 20,
            maxHeight: '80%',
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
          }}>
            <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>
              {selectedBrew?.beanName || 'Brew Details'}
            </Text>
            
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
              {formatDate(selectedBrew?.timestamp || Date.now())}
            </Text>
            
            <Divider style={{ marginVertical: 12 }} />
            
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>AI Brew Suggestions</Text>
              
              {loadingSuggestion ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
                  <ActivityIndicator size="large" color="#2089dc" />
                  <Text style={{ marginTop: 12, color: '#666' }}>Getting suggestions...</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: '#333' }}>
                    {suggestion || 'No suggestions available. Please set your OpenAI API key in settings.'}
                  </Text>
                </ScrollView>
              )}
            </View>
            
            <Divider style={{ marginVertical: 12 }} />
            
            <Button
              title="Close"
              onPress={() => setSuggestionModalVisible(false)}
              buttonStyle={{ borderRadius: 8 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
} 