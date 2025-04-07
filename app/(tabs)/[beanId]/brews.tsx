import React, { useState, useCallback, useEffect } from 'react';
import { FlatList, View, RefreshControl, TouchableOpacity, Modal, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, Divider, Button } from '@rneui/themed';
import { getBrewSuggestions, Brew } from '../../../lib/openai';

// --- Tailwind ---
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../../tailwind.config.js'; // Adjust path

const fullConfig = resolveConfig(tailwindConfig);
const themeColors = fullConfig.theme.colors as unknown as Record<string, string>; 
// --- End Tailwind ---

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
      <Card containerStyle={styles.brewCardContainer}>
        <View style={styles.brewCardHeader}>
          <Text style={styles.brewCardDate}>
            {formatDate(item.timestamp)}
          </Text>
          <Text style={styles.brewCardRating}>
            {item.rating}/10
          </Text>
        </View>
        
        <Divider style={styles.brewCardDivider} />
        
        <Text style={styles.brewCardDetail}>
          Steep time: {formatTime(item.steepTime)}
        </Text>
        
        <Text style={styles.brewCardDetail}>
          Grind: {item.grindSize || 'Not specified'}
        </Text>
        
        <Text style={styles.brewCardDetail}>
          Temp: {item.waterTemp || 'Not specified'}
        </Text>
        
        {item.useBloom && (
          <Text style={styles.brewCardDetail}>
            Bloom: {item.bloomTime || 'Yes'}
          </Text>
        )}
        
        {item.notes && (
          <>
            <Divider style={styles.brewCardNotesDivider} />
            <Text style={styles.brewCardNotesText}>
              {item.notes}
            </Text>
          </>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} className="dark:bg-black" edges={['top', 'left', 'right']}>
      {/* Keep generic title in _layout.tsx, this useEffect will override it */}
      {/* <Stack.Screen options={{ title: beanNameFilter || 'Brews' }} /> */}
      <View style={styles.mainContainer} className="bg-soft-off-white dark:bg-black">
        {/* Removed Filter Dropdown Card */}

        {/* Use FlatList directly with filteredBrews */}
        <FlatList
          data={filteredBrews}
          renderItem={renderBrewItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyListComponent}>
              <Text style={styles.emptyListText}>
                {refreshing ? 'Loading...' : `No brews found for ${beanNameFilter || 'this bean'}`}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadBrews} />
          }
          contentContainerStyle={styles.flatListContentContainer}
        />
      </View>

      {/* Suggestion Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={suggestionModalVisible}
        onRequestClose={() => setSuggestionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedBrew?.beanName || 'Brew Details'}
            </Text>
            
            <Text style={styles.modalDate}>
              {formatDate(selectedBrew?.timestamp || Date.now())}
            </Text>
            
            <Divider style={styles.modalDivider} />
            
            <View style={styles.modalSuggestionContainer}>
              <Text style={styles.modalSuggestionTitle}>AI Brew Suggestions</Text>
              
              {loadingSuggestion ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color={themeColors['cool-gray-green']} />
                  <Text style={styles.modalLoadingText}>Getting suggestions...</Text>
                </View>
              ) : (
                <ScrollView style={styles.modalSuggestionScroll}>
                  <Text style={styles.modalSuggestionText}>
                    {suggestion || 'No suggestions available. Please set your OpenAI API key in settings.'}
                  </Text>
                </ScrollView>
              )}
            </View>
            
            <Divider style={styles.modalDivider} />
            
            <Button
              title="Close"
              onPress={() => setSuggestionModalVisible(false)}
              buttonStyle={styles.modalCloseButton}
              titleStyle={styles.modalCloseButtonTitle}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// StyleSheet for better organization
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: themeColors['soft-off-white']
  },
  mainContainer: {
    flex: 1
  },
  brewCardContainer: {
    borderRadius: 10, 
    marginBottom: 12,
    padding: 16,
    elevation: 1,
    shadowColor: themeColors['charcoal'],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2, 
    backgroundColor: themeColors['soft-off-white']
  },
  brewCardHeader: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 8 
  },
  brewCardDate: {
    fontSize: 14, 
    fontWeight: '500', 
    color: themeColors['cool-gray-green']
  },
  brewCardRating: {
    fontSize: 14, 
    fontWeight: '600', 
    color: themeColors['charcoal']
  },
  brewCardDivider: {
    marginBottom: 12, 
    backgroundColor: themeColors['pale-gray']
  },
  brewCardDetail: {
    fontSize: 14, 
    color: themeColors['charcoal'],
    marginBottom: 4 
  },
  brewCardNotesDivider: {
    marginVertical: 8, 
    backgroundColor: themeColors['pale-gray']
  },
  brewCardNotesText: {
    fontSize: 14, 
    color: themeColors['charcoal'],
    fontStyle: 'italic' 
  },
  emptyListComponent: {
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 64 
  },
  emptyListText: {
    fontSize: 16, 
    color: themeColors['cool-gray-green'],
    textAlign: 'center' 
  },
  flatListContentContainer: {
    paddingHorizontal: 12, 
    paddingTop: 12,
    paddingBottom: 40 
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalContent: {
    width: '90%',
    backgroundColor: themeColors['soft-off-white'],
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    elevation: 5,
    shadowColor: themeColors['charcoal'],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 20, 
    fontWeight: '600', 
    marginBottom: 8,
    color: themeColors['charcoal']
  },
  modalDate: {
    fontSize: 14, 
    color: themeColors['cool-gray-green'],
    marginBottom: 4 
  },
  modalDivider: {
    marginVertical: 12, 
    backgroundColor: themeColors['pale-gray']
  },
  modalSuggestionContainer: {
    // flex: 1 // Removed flex: 1 to allow content to determine height
  },
  modalSuggestionTitle: {
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 8,
    color: themeColors['charcoal']
  },
  modalLoadingContainer: {
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 20 
  },
  modalLoadingText: {
    marginTop: 12, 
    color: themeColors['cool-gray-green']
  },
  modalSuggestionScroll: {
    maxHeight: 300 
  },
  modalSuggestionText: {
    fontSize: 14, 
    lineHeight: 20, 
    color: themeColors['charcoal']
  },
  modalCloseButton: {
    borderRadius: 8,
    backgroundColor: themeColors['pale-gray']
  },
  modalCloseButtonTitle: {
     color: themeColors['charcoal']
  }
}); 