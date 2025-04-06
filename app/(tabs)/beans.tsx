import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Alert, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Button, Card, Text, Input, Divider, Icon } from '@rneui/themed';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getApiKey, getBrewSuggestions, analyzeImage, createOpenAIClient } from '@/lib/openai';

// Storage keys
const BEANS_STORAGE_KEY = '@GoodCup:beans';
const BREWS_STORAGE_KEY = '@GoodCup:brews';
const BEAN_NAMES_STORAGE_KEY = '@GoodCup:beanNames';

// Bean interface
interface Bean {
  id: string;
  name: string;
  roaster: string;
  origin: string;
  process: string;
  roastLevel: string;
  flavorNotes: string[];
  description: string;
  photo?: string; // Base64 encoded image
  timestamp: number;
}

// Simplified Brew interface for extracting bean info
interface Brew {
  id: string;
  beanName: string;
  timestamp: number;
  rating: number;
  notes: string;
  steepTime: number;
  useBloom: boolean;
  bloomTime?: string;
  grindSize: string;
  waterTemp: string;
  brewDevice?: string;
  grinder?: string;
}

export default function BeansScreen() {
  const [beans, setBeans] = useState<Bean[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // New bean form state
  const [newBean, setNewBean] = useState<Partial<Bean>>({
    name: '',
    roaster: '',
    origin: '',
    process: '',
    roastLevel: '',
    flavorNotes: [],
    description: '',
    photo: undefined
  });
  
  // Add a new state for suggestions modal
  const [suggestionModalVisible, setSuggestionModalVisible] = useState(false);
  const [selectedBeanForSuggestion, setSelectedBeanForSuggestion] = useState<Bean | null>(null);
  const [beanSuggestion, setBeanSuggestion] = useState<string>('');
  const [gettingSuggestion, setGettingSuggestion] = useState(false);
  
  // Load beans from all sources
  const loadBeans = useCallback(async () => {
    try {
      // Get beans from beans storage
      const storedBeans = await AsyncStorage.getItem(BEANS_STORAGE_KEY);
      let beansArray: Bean[] = [];
      
      if (storedBeans) {
        beansArray = JSON.parse(storedBeans);
      }
      
      // Get beans from brews data
      const storedBrews = await AsyncStorage.getItem(BREWS_STORAGE_KEY);
      
      if (storedBrews) {
        const brews: Brew[] = JSON.parse(storedBrews);
        
        // Extract unique bean names from brews
        const brewBeanNames = Array.from(new Set(brews.map(brew => brew.beanName)));
        
        // For each bean name that doesn't exist in our beans array, create a basic bean entry
        for (const beanName of brewBeanNames) {
          if (beanName && !beansArray.some(bean => bean.name === beanName)) {
            // Find the highest rated brew for this bean to get description
            const relatedBrews = brews.filter(brew => brew.beanName === beanName);
            const highestRatedBrew = relatedBrews.sort((a, b) => b.rating - a.rating)[0];
            
            // Create a basic bean entry
            const newBean: Bean = {
              id: `brew-bean-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: beanName,
              roaster: 'Unknown',
              origin: 'Unknown',
              process: 'Unknown',
              roastLevel: 'Unknown',
              flavorNotes: [],
              description: highestRatedBrew?.notes || '',
              timestamp: highestRatedBrew?.timestamp || Date.now()
            };
            
            beansArray.push(newBean);
          }
        }
        
        // Sort beans by timestamp (newest first)
        beansArray.sort((a, b) => b.timestamp - a.timestamp);
        
        // Save the updated beans array if we added any new ones
        if (beansArray.length > 0 && (!storedBeans || beansArray.length > JSON.parse(storedBeans).length)) {
          await AsyncStorage.setItem(BEANS_STORAGE_KEY, JSON.stringify(beansArray));
        }
      }
      
      setBeans(beansArray);
    } catch (error) {
      console.error('Error loading beans:', error);
      Alert.alert('Error', 'Failed to load beans.');
    }
  }, []);
  
  // Load beans when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadBeans();
    }, [loadBeans])
  );
  
  // Save beans to storage
  const saveBeans = async (updatedBeans: Bean[]) => {
    try {
      await AsyncStorage.setItem(BEANS_STORAGE_KEY, JSON.stringify(updatedBeans));
      setBeans(updatedBeans);
    } catch (error) {
      console.error('Error saving beans:', error);
      Alert.alert('Error', 'Failed to save beans.');
    }
  };
  
  // Add a new bean
  const addBean = async () => {
    if (!newBean.name || !newBean.roaster) {
      Alert.alert('Missing Information', 'Please enter at least a name and roaster.');
      return;
    }
    
    setLoading(true);
    
    try {
      const beanToAdd: Bean = {
        id: Date.now().toString(),
        name: newBean.name,
        roaster: newBean.roaster,
        origin: newBean.origin || 'Unknown',
        process: newBean.process || 'Unknown',
        roastLevel: newBean.roastLevel || 'Medium',
        flavorNotes: newBean.flavorNotes || [],
        description: newBean.description || '',
        photo: newBean.photo,
        timestamp: Date.now()
      };
      
      const updatedBeans = [...beans, beanToAdd];
      await saveBeans(updatedBeans);
      
      // Reset form
      setNewBean({
        name: '',
        roaster: '',
        origin: '',
        process: '',
        roastLevel: '',
        flavorNotes: [],
        description: '',
        photo: undefined
      });
      
      setShowAddForm(false);
      Alert.alert('Success', 'Bean added successfully!');
    } catch (error) {
      console.error('Error adding bean:', error);
      Alert.alert('Error', 'Failed to add bean.');
    }
    
    setLoading(false);
  };
  
  // Delete a bean
  const deleteBean = async (id: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this bean?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedBeans = beans.filter(bean => bean.id !== id);
            await saveBeans(updatedBeans);
          }
        }
      ]
    );
  };
  
  // Take a photo of a bean package
  const takePhoto = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }
      
      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          setNewBean(prev => ({ ...prev, photo: `data:image/jpeg;base64,${asset.base64}` }));
          
          // Analyze the photo with OpenAI
          await analyzePhoto(`data:image/jpeg;base64,${asset.base64}`);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Note: Camera is not available in simulators.');
    }
  };
  
  // Pick an image from the gallery
  const pickImage = async () => {
    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Media library permission is required to select photos.');
        return;
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          setNewBean(prev => ({ ...prev, photo: `data:image/jpeg;base64,${asset.base64}` }));
          
          // Analyze the photo with OpenAI
          await analyzePhoto(`data:image/jpeg;base64,${asset.base64}`);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };
  
  // Analyze photo with OpenAI
  const analyzePhoto = async (base64Image: string) => {
    setAnalyzing(true);
    
    try {
      // Use the new analyzeImage function from our OpenAI utility
      const extractedData = await analyzeImage(base64Image);
      
      // Update form with extracted data
      setNewBean(prev => ({
        ...prev,
        name: extractedData.name || prev.name,
        roaster: extractedData.roaster || prev.roaster,
        origin: extractedData.origin || prev.origin,
        process: extractedData.process || prev.process,
        roastLevel: extractedData.roastLevel || prev.roastLevel,
        flavorNotes: extractedData.flavorNotes || prev.flavorNotes,
        description: extractedData.description || prev.description
      }));
      
      Alert.alert('Analysis Complete', 'Information extracted from the package photo. Please review and edit if needed.');
    } catch (error: any) {
      console.error('Error analyzing photo:', error);
      
      if (error.message && typeof error.message === 'string' && error.message.includes('API key')) {
        Alert.alert('API Key Required', 'Please set your OpenAI API key in settings first.');
      } else {
        Alert.alert('Error', 'Failed to analyze photo. Please try again later.');
      }
    }
    
    setAnalyzing(false);
  };
  
  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Add a new function to get optimal brew suggestions for a bean
  const getOptimalBrewSuggestions = async (bean: Bean) => {
    setSelectedBeanForSuggestion(bean);
    setSuggestionModalVisible(true);
    setGettingSuggestion(true);
    setBeanSuggestion('');
    
    try {
      // Get all past brews for this bean
      const storedBrews = await AsyncStorage.getItem(BREWS_STORAGE_KEY);
      
      if (!storedBrews) {
        setBeanSuggestion('No brew history found for this bean. Create some brews first to get suggestions.');
        setGettingSuggestion(false);
        return;
      }
      
      const brews: Brew[] = JSON.parse(storedBrews);
      
      // Filter brews for this specific bean
      const beanBrews = brews.filter(brew => brew.beanName === bean.name);
      
      if (beanBrews.length === 0) {
        setBeanSuggestion('No brew history found for this bean. Create some brews first to get suggestions.');
        setGettingSuggestion(false);
        return;
      }
      
      // Sort by rating (highest first)
      const sortedBrews = beanBrews.sort((a, b) => b.rating - a.rating);
      
      // Create a dummy current brew based on the highest rated past brew
      const bestBrew = sortedBrews[0];
      
      // Create OpenAI client
      const openai = await createOpenAIClient();
      if (!openai) {
        setBeanSuggestion('No OpenAI API key found. Please set one in the settings.');
        setGettingSuggestion(false);
        return;
      }
      
      // Get suggestion using the existing function
      const suggestion = await getBrewSuggestions(bestBrew, sortedBrews, bean.name);
      
      // Enhance the suggestion with additional bean-specific information
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: `I have a coffee bean called "${bean.name}" from roaster "${bean.roaster}". 
Origin: ${bean.origin}
Process: ${bean.process}
Roast Level: ${bean.roastLevel}
Flavor Notes: ${bean.flavorNotes.join(', ')}
Description: ${bean.description}

Based on this bean's characteristics and the following brew suggestion:
---
${suggestion}
---

Please provide a comprehensive analysis of:
1. The optimal brewing parameters specifically for this bean type, origin, and process
2. How the roast level affects the extraction and what to adjust
3. What brewing method would best highlight the flavor notes
4. Temperature and grind size recommendations based on the bean characteristics
5. A concise model predictive control approach to adjust parameters if the brew is under or over-extracted

Respond with specific, actionable brewing advice to get the best flavor from this specific bean.`
          }
        ],
        max_tokens: 1000
      });
      
      const enhancedContent = response.choices[0]?.message?.content;
      
      if (enhancedContent) {
        setBeanSuggestion(enhancedContent);
      } else {
        setBeanSuggestion(suggestion);
      }
    } catch (error) {
      console.error('Error getting bean suggestions:', error);
      setBeanSuggestion('Error getting suggestions. Please try again later.');
    }
    
    setGettingSuggestion(false);
  };
  
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <Card containerStyle={styles.headerCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.title}>Coffee Beans</Text>
            <Button
              icon={{ name: 'add', color: 'white', size: 22 }}
              title={showAddForm ? "Cancel" : "Add Bean"}
              onPress={() => setShowAddForm(!showAddForm)}
              buttonStyle={{ ...styles.actionButton, backgroundColor: showAddForm ? '#f44336' : '#2196f3' }}
            />
          </View>
        </Card>
        
        {showAddForm ? (
          <Card containerStyle={styles.formCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formTitle}>Add New Bean</Text>
              
              <View style={styles.photoContainer}>
                {newBean.photo ? (
                  <Image source={{ uri: newBean.photo }} style={styles.beanPhoto} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Icon name="image" type="material" size={40} color="#bdbdbd" />
                    <Text style={{ color: '#757575', marginTop: 8 }}>No Photo</Text>
                  </View>
                )}
                
                <View style={styles.photoButtons}>
                  <Button
                    title="Camera"
                    icon={{ name: 'camera-alt', type: 'material', color: 'white', size: 16 }}
                    onPress={takePhoto}
                    buttonStyle={styles.photoButton}
                  />
                  <Button
                    title="Gallery"
                    icon={{ name: 'photo-library', type: 'material', color: 'white', size: 16 }}
                    onPress={pickImage}
                    buttonStyle={styles.photoButton}
                  />
                </View>
                
                {analyzing && (
                  <View style={styles.analyzerOverlay}>
                    <ActivityIndicator size="large" color="#2196f3" />
                    <Text style={{ marginTop: 12, color: 'white', fontWeight: '500' }}>
                      Analyzing photo...
                    </Text>
                  </View>
                )}
              </View>
              
              <Divider style={styles.divider} />
              
              <Input
                label="Bean Name"
                value={newBean.name}
                onChangeText={(text) => setNewBean({ ...newBean, name: text })}
                placeholder="e.g., Ethiopia Yirgacheffe"
                containerStyle={styles.input}
              />
              
              <Input
                label="Roaster"
                value={newBean.roaster}
                onChangeText={(text) => setNewBean({ ...newBean, roaster: text })}
                placeholder="e.g., Stumptown Coffee"
                containerStyle={styles.input}
              />
              
              <Input
                label="Origin"
                value={newBean.origin}
                onChangeText={(text) => setNewBean({ ...newBean, origin: text })}
                placeholder="e.g., Ethiopia, Yirgacheffe region"
                containerStyle={styles.input}
              />
              
              <Input
                label="Process"
                value={newBean.process}
                onChangeText={(text) => setNewBean({ ...newBean, process: text })}
                placeholder="e.g., Washed, Natural, Honey"
                containerStyle={styles.input}
              />
              
              <Input
                label="Roast Level"
                value={newBean.roastLevel}
                onChangeText={(text) => setNewBean({ ...newBean, roastLevel: text })}
                placeholder="e.g., Light, Medium, Dark"
                containerStyle={styles.input}
              />
              
              <Input
                label="Flavor Notes (comma separated)"
                value={newBean.flavorNotes?.join(', ')}
                onChangeText={(text) => setNewBean({ ...newBean, flavorNotes: text.split(',').map(note => note.trim()).filter(note => note) })}
                placeholder="e.g., Blueberry, Chocolate, Citrus"
                containerStyle={styles.input}
              />
              
              <Input
                label="Description"
                value={newBean.description}
                onChangeText={(text) => setNewBean({ ...newBean, description: text })}
                placeholder="Add notes about this coffee"
                multiline
                numberOfLines={4}
                containerStyle={styles.input}
              />
              
              <Button
                title="Save Bean"
                onPress={addBean}
                loading={loading}
                buttonStyle={styles.saveButton}
                containerStyle={{ marginBottom: 20 }}
              />
            </ScrollView>
          </Card>
        ) : (
          <ScrollView style={{ flex: 1 }}>
            {beans.length === 0 ? (
              <Card containerStyle={styles.emptyCard}>
                <Text style={styles.emptyText}>No beans added yet</Text>
                <Text style={styles.emptySubtext}>
                  Add your first coffee bean by taking a photo of the package
                </Text>
              </Card>
            ) : (
              beans.map((bean) => (
                <Card key={bean.id} containerStyle={styles.beanCard}>
                  <View style={{ flexDirection: 'row' }}>
                    {bean.photo ? (
                      <Image source={{ uri: bean.photo }} style={styles.cardPhoto} />
                    ) : (
                      <View style={styles.cardPhotoPlaceholder}>
                        <Icon name="coffee" type="material" size={24} color="#bdbdbd" />
                      </View>
                    )}
                    
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.beanName}>{bean.name}</Text>
                        <TouchableOpacity onPress={() => deleteBean(bean.id)}>
                          <Icon name="delete" type="material" size={20} color="#f44336" />
                        </TouchableOpacity>
                      </View>
                      
                      <Text style={styles.roasterName}>{bean.roaster}</Text>
                      <Divider style={{ marginVertical: 8 }} />
                      
                      <View style={styles.beanInfo}>
                        <Text style={styles.beanDetail}>Origin: {bean.origin}</Text>
                        <Text style={styles.beanDetail}>Process: {bean.process}</Text>
                        <Text style={styles.beanDetail}>Roast: {bean.roastLevel}</Text>
                        
                        {bean.flavorNotes && bean.flavorNotes.length > 0 && (
                          <View style={{ marginTop: 4 }}>
                            <Text style={styles.beanDetail}>Flavor Notes:</Text>
                            <View style={styles.flavorTags}>
                              {bean.flavorNotes.map((note, index) => (
                                <View key={index} style={styles.flavorTag}>
                                  <Text style={styles.flavorTagText}>{note.trim()}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                        
                        {bean.description && (
                          <Text style={styles.description}>{bean.description}</Text>
                        )}
                        
                        <Text style={styles.timestamp}>Added: {formatDate(bean.timestamp)}</Text>
                        
                        {/* Add Optimal Brew button */}
                        <Button
                          title="Get Optimal Brew"
                          icon={{ name: 'science', type: 'material', color: 'white', size: 16 }}
                          onPress={() => getOptimalBrewSuggestions(bean)}
                          buttonStyle={styles.optimalBrewButton}
                          titleStyle={{ fontSize: 14 }}
                        />
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        )}
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
              {selectedBeanForSuggestion?.name || 'Bean'} Optimal Brew
            </Text>
            
            <Divider style={{ marginVertical: 12 }} />
            
            <ScrollView style={styles.suggestionScrollView}>
              {gettingSuggestion ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196f3" />
                  <Text style={{ marginTop: 12, color: '#666' }}>
                    Analyzing brewing data...
                  </Text>
                </View>
              ) : (
                <Text style={styles.suggestionText}>
                  {beanSuggestion || 'No suggestions available.'}
                </Text>
              )}
            </ScrollView>
            
            <Button
              title="Close"
              onPress={() => setSuggestionModalVisible(false)}
              buttonStyle={{ borderRadius: 8, marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 10,
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333'
  },
  actionButton: {
    borderRadius: 8,
    paddingHorizontal: 12
  },
  formCard: {
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 10,
    padding: 16
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333'
  },
  input: {
    marginBottom: 8
  },
  photoContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 16
  },
  beanPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  photoButtons: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  photoButton: {
    marginHorizontal: 8,
    borderRadius: 8,
    paddingHorizontal: 16
  },
  analyzerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  divider: {
    marginVertical: 16
  },
  saveButton: {
    backgroundColor: '#43a047',
    height: 48,
    borderRadius: 8
  },
  emptyCard: {
    marginHorizontal: 12,
    marginVertical: 16,
    borderRadius: 10,
    padding: 24,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center'
  },
  beanCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    padding: 16
  },
  cardPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8
  },
  cardPhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  beanName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  roasterName: {
    fontSize: 14,
    color: '#757575',
    marginTop: 2
  },
  beanInfo: {
    flex: 1
  },
  beanDetail: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2
  },
  flavorTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8
  },
  flavorTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6
  },
  flavorTagText: {
    fontSize: 12,
    color: '#1976d2'
  },
  description: {
    fontSize: 14,
    color: '#555',
    marginTop: 8,
    fontStyle: 'italic'
  },
  timestamp: {
    fontSize: 12,
    color: '#9e9e9e',
    marginTop: 8,
    textAlign: 'right'
  },
  optimalBrewButton: {
    marginTop: 12,
    backgroundColor: '#5e35b1',
    borderRadius: 8,
    height: 36,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: '#333',
  },
  suggestionScrollView: {
    maxHeight: 400,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  suggestionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
}); 