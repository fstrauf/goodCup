import React, { useState, useCallback } from 'react';
import { FlatList, View, RefreshControl, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, Divider, Button } from '@rneui/themed';
import { Dropdown } from 'react-native-element-dropdown';
import { getBrewSuggestions, Brew } from '../../lib/openai';

// Storage keys
const BREWS_STORAGE_KEY = '@GoodCup:brews';

// Interfaces
interface BeanOption {
  label: string;
  value: string;
}

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
  const [brews, setBrews] = useState<Brew[]>([]);
  const [filteredBrews, setFilteredBrews] = useState<Brew[]>([]);
  const [beanOptions, setBeanOptions] = useState<BeanOption[]>([]);
  const [selectedBean, setSelectedBean] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  
  // Suggestion modal state
  const [suggestionModalVisible, setSuggestionModalVisible] = useState(false);
  const [selectedBrew, setSelectedBrew] = useState<Brew | null>(null);
  const [suggestion, setSuggestion] = useState<string>('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const loadBrews = useCallback(async () => {
    setRefreshing(true);
    try {
      const storedBrews = await AsyncStorage.getItem(BREWS_STORAGE_KEY);
      if (storedBrews !== null) {
        const parsedBrews: Brew[] = JSON.parse(storedBrews);
        
        // Fix any null or undefined bean names
        const fixedBrews = parsedBrews.map(brew => ({
          ...brew,
          beanName: brew.beanName || 'Unnamed Bean'
        }));
        
        // Extract unique bean names for filter dropdown
        const uniqueBeans = Array.from(new Set(fixedBrews.map(brew => brew.beanName)));
        const options = uniqueBeans.map(bean => ({ label: bean, value: bean }));
        
        setBeanOptions([{ label: 'All Beans', value: 'all' }, ...options]);
        setBrews(fixedBrews);
        applyFilters(fixedBrews, selectedBean);
      } else {
        setBrews([]);
        setFilteredBrews([]);
        setBeanOptions([{ label: 'All Beans', value: 'all' }]);
      }
    } catch (e) {
      console.error('Failed to load brews.', e);
      setBrews([]);
      setFilteredBrews([]);
    }
    setRefreshing(false);
  }, [selectedBean]);

  // Apply filtering and sorting
  const applyFilters = useCallback((brewsToFilter: Brew[], bean: string | null) => {
    // Apply bean filter
    let result = brewsToFilter;
    
    if (bean && bean !== 'all') {
      result = result.filter(brew => brew.beanName === bean);
    }
    
    // Sort by date (newest first)
    result.sort((a, b) => b.timestamp - a.timestamp);
    
    setFilteredBrews(result);
  }, []);

  // Handle filter changes
  const handleBeanFilterChange = (item: BeanOption) => {
    const beanValue = item.value === 'all' ? null : item.value;
    setSelectedBean(beanValue);
    applyFilters(brews, beanValue);
  };

  // Get suggestions for a brew
  const fetchSuggestion = async (brew: Brew) => {
    setSelectedBrew(brew);
    setSuggestion('');
    setSuggestionModalVisible(true);
    setLoadingSuggestion(true);
    
    try {
      // Get related brews with same bean
      const relatedBrews = brews.filter(b => b.beanName === brew.beanName && b.id !== brew.id);
      
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

  // useFocusEffect to load brews when the screen comes into focus
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

  // Only group when no filters are applied
  const shouldGroup = !selectedBean;

  // Group brews by bean name when no filters are applied
  const groupedBrews = shouldGroup ? filteredBrews.reduce((acc, brew) => {
    const beanName = brew.beanName || 'Unnamed Bean';
    if (!acc[beanName]) {
      acc[beanName] = [];
    }
    acc[beanName].push(brew);
    return acc;
  }, {} as Record<string, Brew[]>) : null;

  const renderGroupHeader = (beanName: string) => (
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center', 
      marginTop: 16,
      marginBottom: 8, 
      paddingHorizontal: 4 
    }}>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: '600', 
        color: '#333', 
        flex: 1 
      }}>
        {beanName || 'Unnamed Bean'}
      </Text>
      {groupedBrews && (
        <View style={{
          backgroundColor: '#2089dc',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 12,
        }}>
          <Text style={{
            fontSize: 12,
            color: 'white',
            fontWeight: '600'
          }}>
            {groupedBrews[beanName]?.length || 0}
          </Text>
        </View>
      )}
    </View>
  );

  const renderGroupedItem = ({ item }: { item: { beanName: string; brews: Brew[] } }) => (
    <View style={{ marginBottom: 8 }}>
      {renderGroupHeader(item.beanName)}
      {item.brews.map(brew => (
        <View key={brew.id}>{renderBrewItem({ item: brew })}</View>
      ))}
    </View>
  );

  const sections = shouldGroup && groupedBrews ? 
    Object.entries(groupedBrews).map(([beanName, brews]) => ({ beanName, brews })) : 
    null;

  return (
    <SafeAreaView style={{ 
      flex: 1, 
      backgroundColor: 'transparent' 
    }} edges={['top', 'left', 'right']}>
      <View style={{ 
        flex: 1, 
        backgroundColor: '#f5f5f5' 
      }}>
        <Card containerStyle={{
          marginHorizontal: 12,
          marginTop: 12,
          marginBottom: 8,
          borderRadius: 10,
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          padding: 16
        }}>
          <Dropdown
            style={{
              height: 45,
              borderColor: '#e1e1e1',
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 12
            }}
            placeholderStyle={{ color: '#9ca3af' }}
            selectedTextStyle={{ color: '#333' }}
            containerStyle={{ borderRadius: 8 }}
            data={beanOptions}
            labelField="label"
            valueField="value"
            placeholder="Filter by bean"
            value={selectedBean || 'all'}
            onChange={handleBeanFilterChange}
          />
        </Card>

        <View style={{ flex: 1 }}>
          {shouldGroup && sections ? (
            <FlatList
              data={sections}
              renderItem={renderGroupedItem}
              keyExtractor={(group) => group.beanName}
              ListEmptyComponent={
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 64
                }}>
                  <Text style={{
                    fontSize: 16,
                    color: '#888',
                    textAlign: 'center'
                  }}>
                    No brews saved yet
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={loadBrews} />
              }
              contentContainerStyle={{ 
                paddingHorizontal: 12, 
                paddingBottom: 40 
              }}
            />
          ) : (
            <FlatList
              data={filteredBrews}
              renderItem={renderBrewItem}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 64
                }}>
                  <Text style={{
                    fontSize: 16,
                    color: '#888',
                    textAlign: 'center'
                  }}>
                    No brews match your filter
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={loadBrews} />
              }
              contentContainerStyle={{ 
                paddingHorizontal: 12, 
                paddingBottom: 40 
              }}
            />
          )}
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
      </View>
    </SafeAreaView>
  );
} 