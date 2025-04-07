import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Alert, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Text, Input, Divider, Icon } from '@rneui/themed';
import * as ImagePicker from 'expo-image-picker';
import { getApiKey, getBrewSuggestions, analyzeImage, createOpenAIClient } from '../../lib/openai';
import { Dropdown } from 'react-native-element-dropdown';

// Storage keys
const BEANS_STORAGE_KEY = '@GoodCup:beans';
const BREWS_STORAGE_KEY = '@GoodCup:brews';
const BEAN_NAMES_STORAGE_KEY = '@GoodCup:beanNames';

// Bean interface
interface Bean {
  id: string;
  name: string;
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

// Roast Level Options for Dropdown
const roastLevelOptions = [
  { label: 'Light', value: 'light' },
  { label: 'Medium', value: 'medium' },
  { label: 'Dark', value: 'dark' },
  { label: 'Unknown', value: 'unknown' },
];

export default function BeansScreen() {
  const router = useRouter();
  const [beans, setBeans] = useState<Bean[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // New bean form state
  const [newBean, setNewBean] = useState<Partial<Bean>>({
    name: '',
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
            const newBeanEntry: Bean = {
              id: `brew-bean-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: beanName,
              roastLevel: 'unknown',
              flavorNotes: [],
              description: highestRatedBrew?.notes || '',
              timestamp: highestRatedBrew?.timestamp || Date.now()
            };
            
            beansArray.push(newBeanEntry);
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
    if (!newBean.name) {
      Alert.alert('Missing Information', 'Please enter at least a name.');
      return;
    }
    
    setLoading(true);
    
    try {
      const beanToAdd: Bean = {
        id: Date.now().toString(),
        name: newBean.name,
        roastLevel: newBean.roastLevel || 'unknown',
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
      const validRoastLevel = roastLevelOptions.find(o => o.label.toLowerCase() === extractedData.roastLevel?.toLowerCase())?.value;

      setNewBean(prev => ({
        ...prev,
        name: extractedData.name || prev.name,
        roastLevel: validRoastLevel || prev.roastLevel || 'unknown',
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
            content: `I have a coffee bean called "${bean.name}". 
Roast Level: ${bean.roastLevel}
Flavor Notes: ${bean.flavorNotes.join(', ')}
Description: ${bean.description}

Based on this bean's characteristics and the following brew suggestion:
---
${suggestion}
---

Please provide a comprehensive analysis of:
1. The optimal brewing parameters specifically for this bean type
2. How the roast level (${bean.roastLevel}) affects the extraction and what to adjust
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
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View className="flex-1 bg-white dark:bg-black">
          <Card containerStyle={{ marginHorizontal: 12, marginTop: 12, marginBottom: 8, borderRadius: 10, padding: 16, backgroundColor: 'white' }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-semibold text-gray-800">Coffee Beans</Text>
              <Button
                icon={{ name: 'add', color: 'white', size: 22 }}
                title={showAddForm ? "Cancel" : "Add Bean"}
                onPress={() => setShowAddForm(!showAddForm)}
                buttonStyle={{ borderRadius: 8, paddingHorizontal: 12, backgroundColor: showAddForm ? '#f44336' : '#2196f3' }}
              />
            </View>
          </Card>
          
          {showAddForm ? (
            <View className="flex-1">
              <ScrollView
                className="px-3"
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                <View className="bg-white p-4 rounded-lg mb-4">
                  <Text className="text-xl font-semibold mb-4 text-center text-gray-800">Add New Bean</Text>
                  
                  <View className="relative items-center mb-4">
                    {newBean.photo ? (
                      <Image source={{ uri: newBean.photo }} className="w-full h-48 rounded-lg mb-2" />
                    ) : (
                      <View className="w-full h-48 rounded-lg bg-gray-200 justify-center items-center mb-2">
                        <Icon name="image" type="material" size={40} color="#bdbdbd" />
                        <Text className="text-gray-500 mt-2">No Photo</Text>
                      </View>
                    )}
                    
                    <View className="flex-row justify-center mt-2">
                      <Button
                        title="Camera"
                        icon={{ name: 'camera-alt', type: 'material', color: 'white', size: 16 }}
                        onPress={takePhoto}
                        buttonStyle={{ marginHorizontal: 8, borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#607d8b' }}
                        titleStyle={{ fontSize: 14 }}
                      />
                      <Button
                        title="Gallery"
                        icon={{ name: 'photo-library', type: 'material', color: 'white', size: 16 }}
                        onPress={pickImage}
                        buttonStyle={{ marginHorizontal: 8, borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#607d8b' }}
                        titleStyle={{ fontSize: 14 }}
                      />
                    </View>
                    
                    {analyzing && (
                      <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/70 rounded-lg justify-center items-center">
                        <ActivityIndicator size="large" color="#2196f3" />
                        <Text className="mt-3 text-white font-medium">Analyzing photo...</Text>
                      </View>
                    )}
                  </View>
                  
                  <Divider style={{ marginVertical: 16 }} />
                  
                  <Input
                    label="Bean Name"
                    value={newBean.name}
                    onChangeText={(text: string) => setNewBean({ ...newBean, name: text })}
                    placeholder="e.g., Ethiopia Yirgacheffe"
                    containerStyle={{ marginBottom: 8 }}
                    labelStyle={styles.inputLabel}
                  />
                  
                  <Text style={styles.inputLabel}>Roast Level</Text>
                  <Dropdown
                    style={styles.dropdown}
                    placeholderStyle={styles.placeholderStyle}
                    selectedTextStyle={styles.selectedTextStyle}
                    inputSearchStyle={styles.inputSearchStyle}
                    iconStyle={styles.iconStyle}
                    data={roastLevelOptions}
                    maxHeight={300}
                    labelField="label"
                    valueField="value"
                    placeholder="Select roast level"
                    searchPlaceholder="Search..."
                    value={newBean.roastLevel}
                    onChange={item => {
                      setNewBean({ ...newBean, roastLevel: item.value });
                    }}
                  />
                  
                  <Input
                    label="Flavor Notes (comma separated)"
                    value={newBean.flavorNotes?.join(', ')}
                    onChangeText={(text: string) => setNewBean({ ...newBean, flavorNotes: text.split(',').map((note: string) => note.trim()).filter((note: string) => note) })}
                    placeholder="e.g., Blueberry, Chocolate, Citrus"
                    containerStyle={{ marginTop: 8, marginBottom: 8 }}
                    labelStyle={styles.inputLabel}
                  />
                  
                  <Input
                    label="Description"
                    value={newBean.description}
                    onChangeText={(text: string) => setNewBean({ ...newBean, description: text })}
                    placeholder="Additional notes about this coffee"
                    multiline
                    numberOfLines={3}
                    containerStyle={{ marginBottom: 8 }}
                    labelStyle={styles.inputLabel}
                  />
                </View>
              </ScrollView>
              
              <View className="absolute bottom-0 left-0 right-0 bg-white py-2.5 px-4 border-t border-gray-200 z-50 shadow-lg">
                <Button
                  title="Save Bean"
                  onPress={addBean}
                  loading={loading}
                  buttonStyle={{ backgroundColor: '#43a047', height: 48, borderRadius: 8 }}
                  containerStyle={{ width: '100%' }}
                />
              </View>
            </View>
          ) : (
            <ScrollView className="flex-1">
              {beans.length === 0 ? (
                <Card containerStyle={{ marginHorizontal: 12, marginVertical: 16, borderRadius: 10, padding: 24, alignItems: 'center', backgroundColor: 'white' }}>
                  <Text className="text-lg font-semibold text-gray-800 mb-2">No beans added yet</Text>
                  <Text className="text-sm text-gray-500 text-center">
                    Add your first coffee bean by taking a photo of the package
                  </Text>
                </Card>
              ) : (
                beans.map((bean) => (
                  <Card key={bean.id} containerStyle={{ marginHorizontal: 12, marginBottom: 12, borderRadius: 10, padding: 16, backgroundColor: 'white' }}>
                    <View className="flex-row">
                      {bean.photo ? (
                        <Image source={{ uri: bean.photo }} className="w-20 h-20 rounded-lg" />
                      ) : (
                        <View className="w-20 h-20 rounded-lg bg-gray-200 justify-center items-center">
                          <Icon name="coffee" type="material" size={24} color="#bdbdbd" />
                        </View>
                      )}
                      
                      <View className="flex-1 ml-3">
                        <View className="flex-row justify-between">
                          <Text className="text-lg font-semibold text-gray-800">{bean.name}</Text>
                          <TouchableOpacity onPress={() => deleteBean(bean.id)}>
                            <Icon name="delete" type="material" size={20} color="#f44336" />
                          </TouchableOpacity>
                        </View>
                        
                        <Divider style={{ marginVertical: 8 }} />
                        
                        <View className="flex-1">
                          <Text className="text-sm text-gray-700 mb-0.5">
                            Roast: {roastLevelOptions.find(o => o.value === bean.roastLevel)?.label || bean.roastLevel || 'Unknown'}
                          </Text>
                          
                          {bean.flavorNotes && bean.flavorNotes.length > 0 && (
                            <View className="mt-1">
                              <Text className="text-sm text-gray-700">Flavor Notes:</Text>
                              <View className="flex-row flex-wrap mt-1 mb-2">
                                {bean.flavorNotes.map((note: string, index: number) => (
                                  <View key={index} className="bg-blue-100 px-2 py-0.5 rounded-full mr-1.5 mb-1.5">
                                    <Text className="text-xs text-blue-700">{note.trim()}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                          
                          {bean.description && (
                            <Text className="text-sm text-gray-700 mt-2 italic">{bean.description}</Text>
                          )}
                          
                          <Text className="text-xs text-gray-400 mt-2 text-right">Added: {formatDate(bean.timestamp)}</Text>

                          <View className="flex-row justify-around mt-4 pt-3 border-t border-gray-100">
                            <TouchableOpacity 
                              className="flex-1 items-center px-1 py-1" 
                              onPress={() => router.push({ pathname: '/', params: { beanName: bean.name } })}
                            >
                              <Icon name="local-cafe" type="material" size={20} color="#607d8b" />
                              <Text className="text-xs text-center text-[#607d8b] mt-1">Brew</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                              className="flex-1 items-center px-1 py-1 border-l border-r border-gray-100" 
                              onPress={() => router.push({ pathname: '/brews', params: { beanName: bean.name } })}
                            >
                              <Icon name="history" type="material" size={20} color="#607d8b" />
                              <Text className="text-xs text-center text-[#607d8b] mt-1">Review</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              className="flex-1 items-center px-1 py-1" 
                              onPress={() => getOptimalBrewSuggestions(bean)}
                            >
                              <Icon name="science" type="material" size={20} color="#5e35b1" />
                              <Text className="text-xs text-center text-[#5e35b1] mt-1">Suggest</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={suggestionModalVisible}
        onRequestClose={() => setSuggestionModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="w-[90%] bg-white rounded-2xl p-5 max-h-[80%] shadow-lg">
            <Text className="text-xl font-semibold text-center text-gray-800">
              {selectedBeanForSuggestion?.name || 'Bean'} Optimal Brew
            </Text>
            
            <Divider style={{ marginVertical: 12 }} />
            
            <ScrollView style={{ maxHeight: 400 }}>
              {gettingSuggestion ? (
                <View className="items-center justify-center py-8">
                  <ActivityIndicator size="large" color="#2196f3" />
                  <Text className="mt-3 text-gray-500">
                    Analyzing brewing data...
                  </Text>
                </View>
              ) : (
                <Text className="text-base leading-relaxed text-gray-800">
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

// Add styles for Dropdown and consistent Input Label
const styles = StyleSheet.create({
  inputLabel: {
    fontSize: 16,
    color: '#86939e',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  dropdown: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: 'white',
  },
  placeholderStyle: {
    fontSize: 16,
    color: '#adb5bd',
  },
  selectedTextStyle: {
    fontSize: 16,
    color: 'black',
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
  },
}); 