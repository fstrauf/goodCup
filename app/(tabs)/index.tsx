import React, { useState, useCallback } from 'react';
import { View, ScrollView, Alert, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Text, Input, Divider, Icon } from '@rneui/themed';
import * as ImagePicker from 'expo-image-picker';
import { analyzeImage, createOpenAIClient, getBrewSuggestions } from '../../lib/openai';
import { Dropdown } from 'react-native-element-dropdown';

// Storage keys
const BEANS_STORAGE_KEY = '@GoodCup:beans';
const BREWS_STORAGE_KEY = '@GoodCup:brews';

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
    <SafeAreaView className="flex-1 bg-soft-off-white" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View className="flex-1 bg-soft-off-white">
          <Card containerStyle={{
            marginHorizontal: 12,
            marginTop: 12,
            marginBottom: 8,
            borderRadius: 12,
            padding: 16,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E7E7E7',
            shadowColor: '#A8B9AE',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1
          }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-semibold text-charcoal">Coffee Beans</Text>
              <Button
                icon={{ name: 'add', color: showAddForm ? '#4A4A4A' : '#FFFFFF', size: 22 }}
                title={showAddForm ? "Cancel" : "Add Bean"}
                onPress={() => setShowAddForm(!showAddForm)}
                buttonStyle={{
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: showAddForm ? '#E7E7E7' : '#A8B9AE'
                }}
                titleStyle={{
                  color: showAddForm ? '#4A4A4A' : '#FFFFFF',
                  marginLeft: 5
                }}
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
                <View className="bg-soft-off-white p-4 rounded-lg mb-4">
                  <Text className="text-xl font-semibold mb-4 text-center text-charcoal">Add New Bean</Text>
                  
                  <View className="relative items-center mb-4">
                    {newBean.photo ? (
                      <Image source={{ uri: newBean.photo }} className="w-full h-48 rounded-lg mb-2 border border-pebble-gray" />
                    ) : (
                      <View className="w-full h-48 rounded-lg bg-light-beige justify-center items-center mb-2 border border-dashed border-pebble-gray">
                        <Icon name="image-outline" type="material-community" size={40} color="#A8B9AE" />
                        <Text className="text-cool-gray-green mt-2">No Photo</Text>
                      </View>
                    )}
                    
                    <View className="flex-row justify-center mt-2 space-x-3">
                      <Button
                        title="Camera"
                        icon={{ name: 'camera-alt', type: 'material', color: '#4A4A4A', size: 16 }}
                        onPress={takePhoto}
                        buttonStyle={{ borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#E7E7E7' }}
                        titleStyle={{ fontSize: 14, color: '#4A4A4A', marginLeft: 5 }}
                      />
                      <Button
                        title="Gallery"
                        icon={{ name: 'photo-library', type: 'material', color: '#4A4A4A', size: 16 }}
                        onPress={pickImage}
                        buttonStyle={{ borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#E7E7E7' }}
                        titleStyle={{ fontSize: 14, color: '#4A4A4A', marginLeft: 5 }}
                      />
                    </View>
                    
                    {analyzing && (
                      <View className="absolute top-0 left-0 right-0 bottom-0 bg-charcoal/70 rounded-lg justify-center items-center">
                        <ActivityIndicator size="large" color="#A8B9AE" />
                        <Text className="mt-3 text-soft-off-white font-medium">Analyzing photo...</Text>
                      </View>
                    )}
                  </View>
                  
                  <Divider style={{ marginVertical: 16, backgroundColor: '#E7E7E7' }} />
                  
                  <Input
                    label="Bean Name"
                    value={newBean.name}
                    onChangeText={(text: string) => setNewBean({ ...newBean, name: text })}
                    placeholder="e.g., Ethiopia Yirgacheffe"
                    containerStyle={{ marginBottom: 8, paddingHorizontal: 0 }}
                    inputContainerStyle={styles.inputContainerStyle}
                    inputStyle={styles.inputStyle}
                    labelStyle={styles.inputLabelThemed}
                    placeholderTextColor="#A8B9AE"
                  />
                  
                  <Text style={styles.inputLabelThemed}>Roast Level</Text>
                  <Dropdown
                    style={styles.dropdownThemed}
                    placeholderStyle={styles.placeholderStyleThemed}
                    selectedTextStyle={styles.selectedTextStyleThemed}
                    inputSearchStyle={styles.inputSearchStyleThemed}
                    containerStyle={{ borderRadius: 8, borderColor: '#DADADA' }}
                    itemTextStyle={{ color: '#4A4A4A' }}
                    activeColor="#F2EFEA"
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
                    containerStyle={{ marginTop: 16, marginBottom: 8, paddingHorizontal: 0 }}
                    inputContainerStyle={styles.inputContainerStyle}
                    inputStyle={styles.inputStyle}
                    labelStyle={styles.inputLabelThemed}
                    placeholderTextColor="#A8B9AE"
                  />
                  
                  <Input
                    label="Description"
                    value={newBean.description}
                    onChangeText={(text: string) => setNewBean({ ...newBean, description: text })}
                    placeholder="Additional notes about this coffee"
                    multiline
                    numberOfLines={3}
                    containerStyle={{ marginBottom: 8, paddingHorizontal: 0 }}
                    inputContainerStyle={[styles.inputContainerStyle, { minHeight: 80, paddingTop: 10 }]}
                    inputStyle={[styles.inputStyle, { textAlignVertical: 'top'}]}
                    labelStyle={styles.inputLabelThemed}
                    placeholderTextColor="#A8B9AE"
                  />
                </View>
              </ScrollView>
              
              <View className="absolute bottom-0 left-0 right-0 bg-soft-off-white py-2.5 px-4 border-t border-pale-gray z-50 shadow-lg">
                <Button
                  title="Save Bean"
                  onPress={addBean}
                  loading={loading}
                  buttonStyle={{ backgroundColor: '#D4E2D4', height: 48, borderRadius: 8 }}
                  titleStyle={{ color: '#4A4A4A', fontWeight: 'bold' }}
                  containerStyle={{ width: '100%' }}
                  loadingProps={{ color: '#4A4A4A' }}
                />
              </View>
            </View>
          ) : (
            <ScrollView className="flex-1 px-3 pt-2">
              {beans.length === 0 ? (
                <Card containerStyle={{ marginHorizontal: 0, marginVertical: 16, borderRadius: 12, padding: 24, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7E7E7' }}>
                  <Icon name="coffee-off-outline" type="material-community" size={40} color="#A8B9AE" />
                  <Text className="text-lg font-semibold text-charcoal mt-3 mb-2">No beans added yet</Text>
                  <Text className="text-sm text-cool-gray-green text-center">
                    Add your first coffee bean using the 'Add Bean' button above.
                  </Text>
                </Card>
              ) : (
                beans.map((bean) => (
                  <Card key={bean.id} containerStyle={{ marginHorizontal: 0, marginBottom: 16, borderRadius: 12, padding: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7E7E7', shadowColor: '#A8B9AE', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}>
                    <View className="flex-row p-4">
                      {bean.photo ? (
                        <Image source={{ uri: bean.photo }} className="w-20 h-20 rounded-lg border border-pebble-gray" />
                      ) : (
                        <View className="w-20 h-20 rounded-lg bg-light-beige justify-center items-center border border-dashed border-pebble-gray">
                          <Icon name="landscape" type="material" size={30} color="#A8B9AE" />
                        </View>
                      )}

                      <View className="flex-1 ml-4">
                        <View className="flex-row justify-between items-start">
                          <Text className="text-lg font-semibold text-charcoal flex-shrink mr-2" numberOfLines={2}>{bean.name}</Text>
                          <TouchableOpacity onPress={() => deleteBean(bean.id)} className="p-1 -mt-1 -mr-1">
                            <Icon name="close-circle-outline" type="material-community" size={22} color="#A8B9AE" />
                          </TouchableOpacity>
                        </View>

                        <Divider style={{ marginVertical: 8, backgroundColor: '#E7E7E7' }} />

                        <View className="flex-1">
                          <Text className="text-sm text-charcoal mb-0.5">
                            Roast: <Text className="font-medium">{roastLevelOptions.find(o => o.value === bean.roastLevel)?.label || bean.roastLevel || 'Unknown'}</Text>
                          </Text>
                          
                          {bean.flavorNotes && bean.flavorNotes.length > 0 && (
                            <View className="mt-1.5">
                              <Text className="text-sm text-charcoal mb-1">Flavor Notes:</Text>
                              <View className="flex-row flex-wrap">
                                {bean.flavorNotes.map((note: string, index: number) => (
                                  <View key={index} className="bg-mist-blue/50 px-2 py-0.5 rounded-full mr-1.5 mb-1.5 border border-mist-blue">
                                    <Text className="text-xs text-charcoal">{note.trim()}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                          
                          {bean.description && (
                            <Text className="text-sm text-charcoal/80 mt-2 italic" numberOfLines={2}>{bean.description}</Text>
                          )}

                          <Text className="text-xs text-cool-gray-green mt-2 text-right">Added: {formatDate(bean.timestamp)}</Text>
                        </View>
                      </View>
                    </View>
                    
                    <View className="flex-row justify-around items-center mt-2 pt-3 pb-2 border-t border-pale-gray bg-soft-off-white/50 rounded-b-lg">
                        <TouchableOpacity
                          className="flex-1 items-center px-1 py-1"
                          onPress={() => router.push({ pathname: '/[beanId]/brew' as any, params: { beanId: bean.id, beanName: bean.name } })}
                        >
                          <Image source={require('../../assets/images/brew.png')} style={{ width:52, height: 52 }} />
                          <Text className="text-xs text-center text-cool-gray-green mt-1 font-medium">Brew</Text>
                        </TouchableOpacity>

                        <View className="h-full w-px bg-pale-gray" />

                        <TouchableOpacity
                          className="flex-1 items-center px-1 py-1"
                          onPress={() => router.push({ pathname: '/[beanId]/brews' as any, params: { beanId: bean.id, beanName: bean.name } })}
                        >
                          <Image source={require('../../assets/images/past_brews.png')} style={{ width: 52, height: 52 }} />
                          <Text className="text-xs text-center text-cool-gray-green mt-1 font-medium">History</Text>
                        </TouchableOpacity>

                         <View className="h-full w-px bg-pale-gray" />

                        <TouchableOpacity
                          className="flex-1 items-center px-1 py-1"
                          onPress={() => getOptimalBrewSuggestions(bean)}
                        >
                          <Image source={require('../../assets/images/suggest_brew.png')} style={{ width: 52, height: 52 }} />
                          <Text className="text-xs text-center text-cool-gray-green mt-1 font-medium">Suggest</Text>
                        </TouchableOpacity>
                      </View>
                  </Card>
                ))
              )}
              
              <View className="h-5" />
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
        <View className="flex-1 justify-center items-center bg-charcoal/60 p-5">
          <View className="w-full bg-soft-off-white rounded-2xl p-5 max-h-[80%] shadow-lg border border-pale-gray">
            <View className="flex-row justify-between items-center">
               <Text className="text-xl font-semibold text-charcoal flex-1 mr-2" numberOfLines={1}>
                 {selectedBeanForSuggestion?.name || 'Bean'} Suggestion
               </Text>
               <TouchableOpacity onPress={() => setSuggestionModalVisible(false)} className="p-1">
                  <Icon name="close" type="material" size={24} color="#A8B9AE" />
               </TouchableOpacity>
            </View>

            <Divider style={{ marginVertical: 12, backgroundColor: '#E7E7E7' }} />

            <ScrollView style={{ maxHeight: 400 }} className="mb-4">
              {gettingSuggestion ? (
                <View className="items-center justify-center py-8">
                  <ActivityIndicator size="large" color="#A8B9AE" />
                  <Text className="mt-3 text-cool-gray-green">
                    Analyzing brewing data...
                  </Text>
                </View>
              ) : (
                <Text className="text-base leading-relaxed text-charcoal">
                  {beanSuggestion || 'No suggestions available.'}
                </Text>
              )}
            </ScrollView>

            <Button
              title="Close"
              onPress={() => setSuggestionModalVisible(false)}
              buttonStyle={{ backgroundColor: '#E7E7E7', borderRadius: 8, paddingVertical: 10 }}
              titleStyle={{ color: '#4A4A4A', fontWeight: 'bold' }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inputLabelThemed: {
    fontSize: 14,
    color: '#A8B9AE',
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 10
  },
  inputContainerStyle: {
    borderWidth: 1,
    borderColor: '#DADADA',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FAFAF9',
    height: 50
  },
  inputStyle: {
    fontSize: 16,
    color: '#4A4A4A',
  },
  dropdownThemed: {
    height: 50,
    borderColor: '#DADADA',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: '#FAFAF9',
  },
  placeholderStyleThemed: {
    fontSize: 16,
    color: '#A8B9AE',
  },
  selectedTextStyleThemed: {
    fontSize: 16,
    color: '#4A4A4A',
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyleThemed: {
    height: 40,
    fontSize: 16,
    borderColor: '#DADADA',
    borderWidth: 1,
    borderRadius: 4,
    color: '#4A4A4A',
    backgroundColor: '#FFFFFF'
  },
}); 