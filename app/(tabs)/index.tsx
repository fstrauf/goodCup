import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, Text, Platform, Alert, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import { Input, Slider, Switch, Card, Divider, Button as RNEButton } from '@rneui/themed';
import { getBrewSuggestions } from '../../lib/openai';

const BREWS_STORAGE_KEY = '@GoodCup:brews';
const BEAN_NAMES_STORAGE_KEY = '@GoodCup:beanNames';
const BREW_DEVICES_KEY = '@GoodCup:brewDevices';
const GRINDERS_KEY = '@GoodCup:grinders';
const BEANS_STORAGE_KEY = '@GoodCup:beans';
const DEFAULT_BREW_DEVICE_KEY = '@GoodCup:defaultBrewDevice';
const DEFAULT_GRINDER_KEY = '@GoodCup:defaultGrinder';

interface BeanNameOption {
  label: string;
  value: string;
}

interface DropdownItem {
  label: string;
  value: string;
}

interface BrewDevice {
  id: string;
  name: string;
}

interface Grinder {
  id: string;
  name: string;
}

interface Brew {
  id: string;
  timestamp: number;
  beanName: string;
  steepTime: number;
  useBloom: boolean;
  bloomTime?: string;
  grindSize: string;
  waterTemp: string;
  rating: number;
  notes: string;
  brewDevice?: string;
  grinder?: string;
}

interface StoredBean {
  id: string;
  name: string;
  roaster: string;
  origin?: string;
  process?: string;
  roastLevel?: string;
  flavorNotes?: string[];
  description?: string;
  // Other bean properties not needed for this context
}

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const HomeScreenComponent = () => {
  const [beanName, setBeanName] = useState<string | null>(null);
  const [steepTimeSeconds, setSteepTimeSeconds] = useState(180);
  const [useBloom, setUseBloom] = useState(false);
  const [bloomTime, setBloomTime] = useState('');
  const [grindSize, setGrindSize] = useState('');
  const [waterTemp, setWaterTemp] = useState('');
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState('');
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [brewDevices, setBrewDevices] = useState<BrewDevice[]>([]);
  const [grinders, setGrinders] = useState<Grinder[]>([]);
  const [selectedBrewDevice, setSelectedBrewDevice] = useState<string>('');
  const [selectedGrinder, setSelectedGrinder] = useState<string>('');
  const [gettingSuggestion, setGettingSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState<string>('');
  const [showSuggestion, setShowSuggestion] = useState(false);

  const [allBeanNames, setAllBeanNames] = useState<string[]>([]);
  const [beanNameOptions, setBeanNameOptions] = useState<BeanNameOption[]>([]);

  useEffect(() => {
    loadBeanNames();
    loadEquipment();
  }, []);

  useEffect(() => {
    const options = allBeanNames.map(name => ({ label: name, value: name }));
    console.log("[Effect] Derived beanNameOptions:", options);
    setBeanNameOptions(options);
  }, [allBeanNames]);

  useEffect(() => {
    console.log("[Debug] Current beanName state:", beanName);
  }, [beanName]);

  const loadBeanNames = async () => {
    try {
      // First, try to load from the new Beans storage
      const storedBeans = await AsyncStorage.getItem(BEANS_STORAGE_KEY);
      if (storedBeans) {
        const beans = JSON.parse(storedBeans) as StoredBean[];
        const beanNames = beans.map((bean: StoredBean) => bean.name);
        if (beanNames.length > 0) {
          setAllBeanNames(beanNames);
          
          // Create options for dropdown
          const options = beanNames.map((name: string) => ({
            label: name,
            value: name
          }));
          setBeanNameOptions(options);
          return;
        }
      }
      
      // If no beans in new storage, fall back to the old storage method
      const storedNames = await AsyncStorage.getItem(BEAN_NAMES_STORAGE_KEY);
      if (storedNames) {
        const parsedNames = JSON.parse(storedNames) as string[];
        setAllBeanNames(parsedNames);
        
        // Create options for dropdown
        const options = parsedNames.map((name: string) => ({
          label: name,
          value: name
        }));
        setBeanNameOptions(options);
      }
    } catch (error) {
      console.error('Error loading bean names:', error);
    }
  };

  const loadEquipment = async () => {
    try {
      const storedDevices = await AsyncStorage.getItem(BREW_DEVICES_KEY);
      const storedGrinders = await AsyncStorage.getItem(GRINDERS_KEY);
      const defaultDeviceId = await AsyncStorage.getItem(DEFAULT_BREW_DEVICE_KEY);
      const defaultGrinderId = await AsyncStorage.getItem(DEFAULT_GRINDER_KEY);
      
      if (storedDevices) {
        setBrewDevices(JSON.parse(storedDevices));
      }
      
      if (storedGrinders) {
        setGrinders(JSON.parse(storedGrinders));
      }

      // Set default selections if available
      if (defaultDeviceId) {
        setSelectedBrewDevice(defaultDeviceId);
      }
      
      if (defaultGrinderId) {
        setSelectedGrinder(defaultGrinderId);
      }
    } catch (error) {
      console.error('Error loading equipment:', error);
    }
  };

  const saveBeanName = async (nameToSave: string | null) => {
    console.log("[saveBeanName] Attempting to save:", nameToSave);
    if (!nameToSave || allBeanNames.includes(nameToSave)) {
      console.log("[saveBeanName] Skipping save (null, empty, or duplicate).");
      return;
    }
    try {
      const updatedNames = [...allBeanNames, nameToSave].sort();
      console.log("[saveBeanName] Saving updated names:", updatedNames);
      setAllBeanNames(updatedNames);
      
      // Create the option immediately and add it to options
      const newOption = { label: nameToSave, value: nameToSave };
      const updatedOptions = [...beanNameOptions, newOption].sort((a, b) => a.label.localeCompare(b.label));
      setBeanNameOptions(updatedOptions);
      
      await AsyncStorage.setItem(BEAN_NAMES_STORAGE_KEY, JSON.stringify(updatedNames));
      console.log("[saveBeanName] Successfully saved to AsyncStorage");
    } catch (e) {
      console.error("[saveBeanName] Failed to save bean name.", e);
    }
  };

  const handleSaveBrew = async () => {
    console.log("[handleSaveBrew] Current beanName state before save:", beanName);
    if (!beanName || !grindSize || !waterTemp) {
      Alert.alert('Missing Info', 'Please fill in Bean Name, Grind Size, and Water Temp.');
      return;
    }
    
    await saveBeanName(beanName);
    
    const newBrew: Brew = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      beanName: beanName,
      steepTime: steepTimeSeconds,
      useBloom,
      bloomTime: useBloom ? bloomTime : undefined,
      grindSize,
      waterTemp,
      rating,
      notes,
      brewDevice: selectedBrewDevice || undefined,
      grinder: selectedGrinder || undefined
    };
    console.log("[handleSaveBrew] Saving newBrew object:", newBrew);

    try {
      const storedBrews = await AsyncStorage.getItem(BREWS_STORAGE_KEY);
      const existingBrews: Brew[] = storedBrews ? JSON.parse(storedBrews) : [];
      const updatedBrews = [...existingBrews, newBrew];
      await AsyncStorage.setItem(BREWS_STORAGE_KEY, JSON.stringify(updatedBrews));

      setBeanName(null);
      setSteepTimeSeconds(180);
      setUseBloom(false);
      setBloomTime('');
      setGrindSize('');
      setWaterTemp('');
      setRating(5);
      setNotes('');
      Alert.alert('Success', 'Brew saved successfully!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[handleSaveBrew] Failed to save brew.', e);
      Alert.alert('Error', 'Could not save the brew.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const onSliderChange = (value: number, type: 'time' | 'rating') => {
    if (type === 'time') {
      setSteepTimeSeconds(value);
    } else {
      setRating(value);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Timer functionality
  const startTimer = useCallback(() => {
    if (timerActive) return;
    
    setTimerActive(true);
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
    
    setTimerInterval(interval);
  }, [timerActive]);

  const stopTimer = useCallback(() => {
    if (!timerActive) return;
    
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    setTimerActive(false);
    setSteepTimeSeconds(timerSeconds);
    setTimerInterval(null);
  }, [timerActive, timerInterval, timerSeconds]);

  const resetTimer = useCallback(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    setTimerActive(false);
    setTimerSeconds(0);
    setTimerInterval(null);
  }, [timerInterval]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  // Get AI suggestions for the current brew
  const getAiSuggestions = async () => {
    if (!beanName || !grindSize || !waterTemp) {
      Alert.alert('Missing Info', 'Please fill in Bean Name, Grind Size, and Water Temp.');
      return;
    }

    setGettingSuggestion(true);
    setSuggestion('');
    setShowSuggestion(true);
    
    try {
      // Create current brew object
      const currentBrew: Brew = {
        id: 'temp',
        timestamp: Date.now(),
        beanName: beanName,
        steepTime: steepTimeSeconds,
        useBloom,
        bloomTime: useBloom ? bloomTime : undefined,
        grindSize,
        waterTemp,
        rating,
        notes,
        brewDevice: selectedBrewDevice || undefined,
        grinder: selectedGrinder || undefined
      };
      
      // Get existing brews
      const storedBrews = await AsyncStorage.getItem(BREWS_STORAGE_KEY);
      let brews: Brew[] = [];
      
      if (storedBrews) {
        brews = JSON.parse(storedBrews);
      }
      
      // Get previous brews with same bean
      const relatedBrews = brews.filter(brew => 
        brew.beanName.toLowerCase() === beanName.toLowerCase()
      );
      
      // Get suggestions
      const result = await getBrewSuggestions(currentBrew, relatedBrews, beanName);
      setSuggestion(result);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      setSuggestion('Error getting suggestions. Please check your OpenAI API key in settings.');
    }
    
    setGettingSuggestion(false);
  };

  // Format brew devices and grinders for dropdown
  const brewDeviceOptions: DropdownItem[] = brewDevices.map(device => ({
    label: device.name,
    value: device.id
  }));
  
  const grinderOptions: DropdownItem[] = grinders.map(grinder => ({
    label: grinder.name,
    value: grinder.id
  }));

  console.log("[Render] Data passed to Dropdown:", beanNameOptions);

  // Function to get bean details to display additional info on selection
  const getBeanDetails = useCallback(async (beanName: string) => {
    if (!beanName) return null;
    
    try {
      const storedBeans = await AsyncStorage.getItem(BEANS_STORAGE_KEY);
      if (storedBeans) {
        const beans = JSON.parse(storedBeans) as StoredBean[];
        const matchedBean = beans.find(bean => bean.name === beanName);
        
        if (matchedBean) {
          // If we find bean details, show them to the user
          Alert.alert(
            `${matchedBean.name}`,
            `Roaster: ${matchedBean.roaster}\nOrigin: ${matchedBean.origin}\nProcess: ${matchedBean.process}\nRoast: ${matchedBean.roastLevel}${matchedBean.flavorNotes?.length ? `\n\nFlavor Notes: ${matchedBean.flavorNotes.join(', ')}` : ''}${matchedBean.description ? `\n\n${matchedBean.description}` : ''}`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error getting bean details:', error);
    }
  }, []);

  // Update the handleBeanChange function
  const handleBeanChange = (value: string) => {
    setBeanName(value);
    
    // Show bean details if available
    if (value) {
      getBeanDetails(value);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
      <View className="flex-1 bg-white dark:bg-black px-3">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Card 
            containerStyle={{
              borderRadius: 10,
              paddingHorizontal: 0,
              paddingVertical: 0,
              elevation: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              marginBottom: 40,
              marginHorizontal: 0,
            }}
            wrapperStyle={{ padding: 0 }}
          >            

            <Divider style={{ marginBottom: 16, backgroundColor: '#e1e1e1', height: 1 }} />
            
            <View className="px-4 pb-2">
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-medium text-gray-800">Steep Time</Text>
                  <Text className="text-base font-semibold text-blue-600">
                    {formatTime(timerActive ? timerSeconds : steepTimeSeconds)}
                  </Text>
                </View>
                <Slider
                  value={steepTimeSeconds}
                  onValueChange={(value) => onSliderChange(value, 'time')}
                  minimumValue={30}
                  maximumValue={240}
                  step={5}
                  allowTouchTrack={true}
                  minimumTrackTintColor="#2089dc"
                  maximumTrackTintColor="#d3d3d3"
                  thumbTintColor="#2089dc"
                  trackStyle={{ height: 6, borderRadius: 3 }}
                  thumbStyle={{ height: 20, width: 20, backgroundColor: 'white', borderWidth: 2, borderColor: '#2089dc' }}
                />
              </View>

              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-base font-medium text-gray-800">Use Bloom?</Text>
                <Switch
                  value={useBloom}
                  onValueChange={setUseBloom}
                  color="#2089dc"
                />
              </View>

              {useBloom && (
                <View className="mb-4">
                  <Text className="text-base font-medium text-gray-800 mb-2">Bloom Time (e.g., 0:30)</Text>
                  <Input
                    value={bloomTime}
                    onChangeText={setBloomTime}
                    placeholder="Minutes:Seconds"
                    placeholderTextColor="#9CA3AF"
                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                    inputContainerStyle={{ borderWidth: 1, borderColor: '#e1e1e1', borderRadius: 8, paddingHorizontal: 10 }}
                  />
                </View>
              )}

              <View className="mb-4">
                <Text className="text-base font-medium text-gray-800 mb-2">Grind Size</Text>
                <Input
                  value={grindSize}
                  onChangeText={setGrindSize}
                  placeholder="Medium-Fine, 18 clicks, etc."
                  placeholderTextColor="#9CA3AF"
                  inputContainerStyle={{ borderWidth: 1, borderColor: '#e1e1e1', borderRadius: 8, paddingHorizontal: 10 }}
                />
              </View>

              <View className="mb-4">
                <Text className="text-base font-medium text-gray-800 mb-2">Water Temperature</Text>
                <Input
                  value={waterTemp}
                  onChangeText={setWaterTemp}
                  placeholder="Temperature in °C or °F"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  inputContainerStyle={{ borderWidth: 1, borderColor: '#e1e1e1', borderRadius: 8, paddingHorizontal: 10 }}
                />
              </View>
            </View>

            <Divider style={{ marginVertical: 16, backgroundColor: '#e1e1e1', height: 1 }} />
            
            <View className="px-4 pb-2">
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-medium text-gray-800">Rating</Text>
                  <Text className="text-base font-semibold text-blue-600">{rating}/10</Text>
                </View>
                <Slider
                  value={rating}
                  onValueChange={(value) => onSliderChange(value, 'rating')}
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  allowTouchTrack={true}
                  minimumTrackTintColor="#2089dc"
                  maximumTrackTintColor="#d3d3d3"
                  thumbTintColor="#2089dc"
                  trackStyle={{ height: 6, borderRadius: 3 }}
                  thumbStyle={{ height: 20, width: 20, backgroundColor: 'white', borderWidth: 2, borderColor: '#2089dc' }}
                />
              </View>

              <View className="mb-4">
                <Text className="text-base font-medium text-gray-800 mb-2">Notes</Text>
                <Input
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Tasting notes, observations, etc."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  inputContainerStyle={{ 
                    borderWidth: 1, 
                    borderColor: '#e1e1e1', 
                    borderRadius: 8, 
                    paddingHorizontal: 10,
                    minHeight: 100
                  }}
                  inputStyle={{ 
                    textAlignVertical: 'top',
                    paddingTop: Platform.OS === 'ios' ? 10 : 10,
                    paddingBottom: 10,
                    minHeight: 80,
                  }}
                />
              </View>
            </View>
            
            <View className="px-4 pb-2">
              <View className="mb-4">
                <Text className="text-base font-medium text-gray-800 mb-2">Brew Device</Text>
                <Dropdown
                  style={{
                    height: 50,
                    borderColor: '#e1e1e1',
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                  }}
                  placeholderStyle={{ color: '#9e9e9e' }}
                  selectedTextStyle={{ color: '#333' }}
                  data={brewDeviceOptions}
                  maxHeight={300}
                  labelField="label"
                  valueField="value"
                  placeholder="Select brew device"
                  value={selectedBrewDevice}
                  onChange={(item: DropdownItem) => setSelectedBrewDevice(item.value)}
                  disable={brewDeviceOptions.length === 0}
                />
                {brewDeviceOptions.length === 0 && (
                  <Text className="text-xs text-gray-500 ml-2 mt-1">Add brew devices in Settings</Text>
                )}
              </View>

              <View className="mb-4">
                <Text className="text-base font-medium text-gray-800 mb-2">Grinder</Text>
                <Dropdown
                   style={{
                    height: 50,
                    borderColor: '#e1e1e1',
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                  }}
                  placeholderStyle={{ color: '#9e9e9e' }}
                  selectedTextStyle={{ color: '#333' }}
                  data={grinderOptions}
                  maxHeight={300}
                  labelField="label"
                  valueField="value"
                  placeholder="Select grinder"
                  value={selectedGrinder}
                  onChange={(item: DropdownItem) => setSelectedGrinder(item.value)}
                  disable={grinderOptions.length === 0}
                />
                {grinderOptions.length === 0 && (
                  <Text className="text-xs text-gray-500 ml-2 mt-1">Add grinders in Settings</Text>
                )}
              </View>
            </View>

            <View className="px-4 pb-2">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-base font-medium text-gray-800">Timer</Text>
                <Text className="text-base font-semibold text-blue-600">
                  {formatTime(timerActive ? timerSeconds : steepTimeSeconds)}
                </Text>
              </View>
              <View className="flex-row justify-around items-center mt-2">
                <RNEButton
                  title={timerActive ? "Stop" : "Start"}
                  onPress={timerActive ? stopTimer : startTimer}
                  buttonStyle={{ borderRadius: 8, paddingHorizontal: 16 }}
                  containerStyle={{ flex: 1, marginRight: 4 }}
                />
                <RNEButton
                  title="Reset"
                  onPress={resetTimer}
                  buttonStyle={{ borderRadius: 8, paddingHorizontal: 16 }}
                  containerStyle={{ flex: 1, marginLeft: 4 }}
                  color="#607d8b"
                />
              </View>
            </View>

            <Divider style={{ marginVertical: 16, backgroundColor: '#e1e1e1', height: 1 }} />
            
            <View className="px-4 pb-2">
              <RNEButton
                title="Get AI Suggestions"
                onPress={getAiSuggestions}
                buttonStyle={{ height: 48, borderRadius: 8, backgroundColor: '#5e35b1' }}
                loading={gettingSuggestion}
                icon={{ name: 'lightbulb-outline', type: 'material', color: 'white', size: 18 }}
              />
            </View>

            {showSuggestion && (
              <View className="px-4 pb-2">
                <Card containerStyle={{ borderRadius: 8, padding: 16, backgroundColor: '#f9f4ff', marginTop: 8, marginHorizontal: 0 }}>
                  <Text className="text-lg font-semibold mb-3 text-purple-700">AI Suggestions</Text>
                  {gettingSuggestion ? (
                    <ActivityIndicator size="large" color="#5e35b1" style={{ marginVertical: 20 }} />
                  ) : (
                    <Text className="text-sm leading-5 text-gray-800">
                      {suggestion || 'No suggestions available. Please check your OpenAI API key in settings.'}
                    </Text>
                  )}
                  <RNEButton
                    title="Hide Suggestions"
                    onPress={() => setShowSuggestion(false)}
                    buttonStyle={{ marginTop: 12 }}
                    type="clear"
                    titleStyle={{ color: '#5e35b1' }}
                  />
                </Card>
              </View>
            )}

            <View className="px-4 pt-4 pb-4">
              <RNEButton
                title="Save Brew"
                onPress={handleSaveBrew}
                buttonStyle={{ backgroundColor: '#2089dc', borderRadius: 8, height: 50 }}
                raised
                disabled={!beanName}
              />
            </View>

          </Card>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default HomeScreenComponent;