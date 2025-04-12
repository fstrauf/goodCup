import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, Text, Platform, Alert, View, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import { Input, Slider, Switch, Card, Divider, Button as RNEButton, Icon } from '@rneui/themed';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useRouter } from 'expo-router';
import BeanNameHeader from '../../../components/BeanNameHeader'; // Trying path relative to app/(tabs)

// --- Tailwind ---
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../../tailwind.config.js'; // Adjust path

const fullConfig = resolveConfig(tailwindConfig);
const themeColors = fullConfig.theme.colors as unknown as Record<string, string>; 
// --- End Tailwind ---

const BREWS_STORAGE_KEY = '@GoodCup:brews';
const BREW_DEVICES_STORAGE_KEY = '@GoodCup:brewDevices';
const GRINDERS_STORAGE_KEY = '@GoodCup:grinders';
const DEFAULT_BREW_DEVICE_KEY = '@GoodCup:defaultBrewDevice';
const DEFAULT_GRINDER_KEY = '@GoodCup:defaultGrinder';

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
  const params = useLocalSearchParams<{ 
    beanName?: string;
    suggestion?: string;
    grindSize?: string;
    waterTemp?: string;
    steepTime?: string;
    useBloom?: string;
    bloomTime?: string;
  }>();
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
  
  // New state for suggestion modal
  const [suggestionModalVisible, setSuggestionModalVisible] = useState(false);
  
  // Reference to track if this is the first render
  const isFirstRender = useRef(true);

  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    console.log("[brew.tsx Effect] Received route params:", JSON.stringify(params));
    if (params.beanName) {
      setBeanName(params.beanName);
      console.log("[Effect] Bean name set from route params:", params.beanName);
    } else {
      console.warn("[Effect] No beanName found in route params.");
    }
    
    // Set parameters from suggestion if provided
    if (params.suggestion) {
      setSuggestion(params.suggestion);
      
      // Set form values if provided
      if (params.grindSize) setGrindSize(params.grindSize);
      if (params.waterTemp) setWaterTemp(params.waterTemp);
      
      if (params.steepTime) {
        const time = parseInt(params.steepTime);
        if (!isNaN(time)) {
          setSteepTimeSeconds(time);
        }
      }
      
      if (params.useBloom === 'true') {
        setUseBloom(true);
        if (params.bloomTime) setBloomTime(params.bloomTime);
      }
      
      // Show suggestion modal after a short delay to ensure the screen is fully loaded
      setTimeout(() => setSuggestionModalVisible(true), 300);
    }
  }, [params]);

  // Effect to update header title
  useEffect(() => {
    if (beanName) {
      navigation.setOptions({ title: beanName });
    } else {
      navigation.setOptions({ title: 'New Brew' });
    }
  }, [beanName, navigation]);

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      const storedDevices = await AsyncStorage.getItem(BREW_DEVICES_STORAGE_KEY);
      const storedGrinders = await AsyncStorage.getItem(GRINDERS_STORAGE_KEY);
      const defaultDeviceId = await AsyncStorage.getItem(DEFAULT_BREW_DEVICE_KEY);
      const defaultGrinderId = await AsyncStorage.getItem(DEFAULT_GRINDER_KEY);
      
      let devices: BrewDevice[] = [];
      let grinders: Grinder[] = [];

      if (storedDevices) {
        devices = JSON.parse(storedDevices);
        setBrewDevices(devices);
        console.log("[LoadEquipment] Loaded brew devices:", devices.length);
      }
      
      if (storedGrinders) {
        grinders = JSON.parse(storedGrinders);
        setGrinders(grinders);
        console.log("[LoadEquipment] Loaded grinders:", grinders.length);
      }

      // Set default selections if available AND if the default device/grinder still exists
      if (defaultDeviceId && devices.some(d => d.id === defaultDeviceId)) {
        console.log("[LoadEquipment] Setting default brew device:", defaultDeviceId);
        setSelectedBrewDevice(defaultDeviceId);
      } else if (defaultDeviceId) {
         console.warn("[LoadEquipment] Saved default brew device not found in current list:", defaultDeviceId);
         // Optionally remove the invalid default from storage
         // await AsyncStorage.removeItem(DEFAULT_BREW_DEVICE_KEY);
      }
      
      if (defaultGrinderId && grinders.some(g => g.id === defaultGrinderId)) {
        console.log("[LoadEquipment] Setting default grinder:", defaultGrinderId);
        setSelectedGrinder(defaultGrinderId);
      } else if (defaultGrinderId) {
         console.warn("[LoadEquipment] Saved default grinder not found in current list:", defaultGrinderId);
         // Optionally remove the invalid default from storage
         // await AsyncStorage.removeItem(DEFAULT_GRINDER_KEY);
      }
    } catch (error) {
      console.error('Error loading equipment:', error);
    }
  };

  const handleSaveBrew = async () => {
    console.log("[handleSaveBrew] Current beanName state before save:", beanName);
    if (!beanName || !grindSize || !waterTemp) {
      Alert.alert('Missing Info', 'Please fill in Grind Size, and Water Temp (Bean should be pre-selected).');
      return;
    }
    
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

      setSteepTimeSeconds(180);
      setUseBloom(false);
      setBloomTime('');
      setGrindSize('');
      setWaterTemp('');
      setRating(5);
      setNotes('');
      Alert.alert('Success', `Brew saved for ${beanName}!`, [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to the beans list
            router.replace('/');
          }
        }
      ]);
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

  // Format brew devices and grinders for dropdown
  const brewDeviceOptions: DropdownItem[] = brewDevices.map(device => ({
    label: device.name,
    value: device.id
  }));
  
  const grinderOptions: DropdownItem[] = grinders.map(grinder => ({
    label: grinder.name,
    value: grinder.id
  }));

  if (!beanName) {
    return (
      <SafeAreaView className="flex-1 bg-soft-off-white justify-center items-center">
        <ActivityIndicator size="large" color={themeColors['cool-gray-green']} />
        <Text className="text-cool-gray-green mt-2">Loading bean...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-soft-off-white" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1 px-3"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card 
          containerStyle={{
            backgroundColor: themeColors['soft-off-white'],
            borderRadius: 12,
            borderWidth: 1, 
            borderColor: themeColors['pale-gray'],
            paddingHorizontal: 0,
            paddingVertical: 0,
            marginBottom: 24,
            marginHorizontal: 0,
            shadowColor: themeColors['cool-gray-green'],
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
          wrapperStyle={{ padding: 0 }}
        >
          {/* Use the reusable component */}
          <BeanNameHeader beanName={beanName} prefix="Brewing:" />

          <View className="px-4 pb-2">
            <Text className="text-lg font-semibold text-charcoal mb-3">Brew Parameters</Text>
            
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-base font-medium text-charcoal">Steep Time</Text>
                <Text className="text-base font-semibold text-cool-gray-green">
                  {formatTime(timerActive ? timerSeconds : steepTimeSeconds)}
                </Text>
              </View>
              <Slider
                value={steepTimeSeconds}
                onValueChange={(value) => onSliderChange(value, 'time')}
                minimumValue={30}
                maximumValue={300}
                step={5}
                allowTouchTrack={true}
                minimumTrackTintColor={themeColors['cool-gray-green']}
                maximumTrackTintColor={themeColors['pale-gray']}
                thumbTintColor={themeColors['cool-gray-green']}
                trackStyle={{ height: 6, borderRadius: 3 }}
                thumbStyle={{ height: 20, width: 20, backgroundColor: themeColors['soft-off-white'], borderWidth: 2, borderColor: themeColors['cool-gray-green'] }}
              />
            </View>

            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-medium text-charcoal">Use Bloom?</Text>
              <Switch
                value={useBloom}
                onValueChange={setUseBloom}
                color={themeColors['cool-gray-green']}
              />
            </View>

            {useBloom && (
              <View className="mb-4">
                <Text className="text-base font-medium text-charcoal mb-2">Bloom Time (e.g., 0:30)</Text>
                <Input
                  value={bloomTime}
                  onChangeText={setBloomTime}
                  placeholder="Minutes:Seconds"
                  placeholderTextColor={themeColors['cool-gray-green']}
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                  inputContainerStyle={{
                    borderWidth: 1,
                    borderColor: themeColors['pebble-gray'],
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    backgroundColor: themeColors['soft-off-white'],
                  }}
                  inputStyle={{ color: themeColors['charcoal'] }}
                />
              </View>
            )}

            <View className="mb-4">
              <Text className="text-base font-medium text-charcoal mb-2">Grind Size</Text>
              <Input
                value={grindSize}
                onChangeText={setGrindSize}
                placeholder="Medium-Fine, 18 clicks, etc."
                placeholderTextColor={themeColors['cool-gray-green']}
                inputContainerStyle={{
                   borderWidth: 1, 
                   borderColor: themeColors['pebble-gray'],
                   borderRadius: 8, 
                   paddingHorizontal: 10,
                   backgroundColor: themeColors['soft-off-white']
                }}
                inputStyle={{ color: themeColors['charcoal'] }}
              />
            </View>

            <View className="mb-4">
              <Text className="text-base font-medium text-charcoal mb-2">Water Temperature</Text>
              <Input
                value={waterTemp}
                onChangeText={setWaterTemp}
                placeholder="96°C or 205°F"
                placeholderTextColor={themeColors['cool-gray-green']}
                keyboardType="numeric"
                inputContainerStyle={{
                  borderWidth: 1, 
                  borderColor: themeColors['pebble-gray'],
                  borderRadius: 8, 
                  paddingHorizontal: 10,
                  backgroundColor: themeColors['soft-off-white']
                }}
                 inputStyle={{ color: themeColors['charcoal'] }}
              />
            </View>
          </View>

          <Divider style={{ marginVertical: 16, backgroundColor: themeColors['pale-gray'], height: 1 }} />
          
          <View className="px-4 pb-2">
            <Text className="text-lg font-semibold text-charcoal mb-3">Rating & Notes</Text>
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-base font-medium text-charcoal">Rating</Text>
                <Text className="text-base font-semibold text-cool-gray-green">{rating}/10</Text>
              </View>
              <Slider
                value={rating}
                onValueChange={(value) => onSliderChange(value, 'rating')}
                minimumValue={1}
                maximumValue={10}
                step={1}
                allowTouchTrack={true}
                minimumTrackTintColor={themeColors['cool-gray-green']}
                maximumTrackTintColor={themeColors['pale-gray']}
                thumbTintColor={themeColors['cool-gray-green']}
                trackStyle={{ height: 6, borderRadius: 3 }}
                thumbStyle={{ height: 20, width: 20, backgroundColor: themeColors['soft-off-white'], borderWidth: 2, borderColor: themeColors['cool-gray-green'] }}
              />
            </View>

            <View className="mb-4">
              <Text className="text-base font-medium text-charcoal mb-2">Notes</Text>
              <Input
                value={notes}
                onChangeText={setNotes}
                placeholder="Tasting notes, observations, etc."
                placeholderTextColor={themeColors['cool-gray-green']}
                multiline
                numberOfLines={4}
                inputContainerStyle={{
                  borderWidth: 1,
                  borderColor: themeColors['pebble-gray'],
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  minHeight: 100,
                  backgroundColor: themeColors['soft-off-white']
                }}
                inputStyle={{
                  color: themeColors['charcoal'],
                  textAlignVertical: 'top',
                  paddingTop: Platform.OS === 'ios' ? 0 : 0,
                  minHeight: 80,
                }}
              />
            </View>
          </View>
          
          <View className="px-4 pb-2">
            <Text className="text-lg font-semibold text-charcoal mb-3">Equipment</Text>
            <View className="mb-4">
              <Text className="text-base font-medium text-charcoal mb-2">Brew Device</Text>
              <Dropdown
                style={{
                  height: 50,
                  borderColor: themeColors['pebble-gray'],
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  backgroundColor: themeColors['soft-off-white']
                }}
                placeholderStyle={{ color: themeColors['cool-gray-green'] }}
                selectedTextStyle={{ color: themeColors['charcoal'] }}
                containerStyle={{ borderRadius: 8, borderColor: themeColors['pebble-gray'] }}
                itemTextStyle={{ color: themeColors['charcoal'] }}
                activeColor={themeColors['light-beige']}
                data={brewDeviceOptions}
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder={brewDeviceOptions.length === 0 ? "Add in Settings" : "Select brew device"}
                value={selectedBrewDevice}
                onChange={(item: DropdownItem) => {
                  console.log("Selected brew device:", item);
                  setSelectedBrewDevice(item.value);
                }}
                disable={brewDeviceOptions.length === 0}
                search={false}
                renderItem={(item, selected) => (
                  <View style={{ 
                    padding: 12, 
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: selected ? themeColors['light-beige'] : 'transparent'
                  }}>
                    <Text style={{ color: themeColors['charcoal'] }}>{item.label}</Text>
                  </View>
                )}
              />
              {brewDeviceOptions.length === 0 && (
                <Text className="text-xs text-cool-gray-green ml-2 mt-1">Add brew devices in Settings</Text>
              )}
            </View>

            <View className="mb-4">
              <Text className="text-base font-medium text-charcoal mb-2">Grinder</Text>
              <Dropdown
                 style={{
                  height: 50,
                  borderColor: themeColors['pebble-gray'],
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  backgroundColor: themeColors['soft-off-white']
                }}
                placeholderStyle={{ color: themeColors['cool-gray-green'] }}
                selectedTextStyle={{ color: themeColors['charcoal'] }}
                containerStyle={{ borderRadius: 8, borderColor: themeColors['pebble-gray'] }}
                itemTextStyle={{ color: themeColors['charcoal'] }}
                activeColor={themeColors['light-beige']}
                data={grinderOptions}
                maxHeight={300}
                labelField="label"
                valueField="value"
                placeholder={grinderOptions.length === 0 ? "Add in Settings" : "Select grinder"}
                value={selectedGrinder}
                onChange={(item: DropdownItem) => {
                  console.log("Selected grinder:", item);
                  setSelectedGrinder(item.value);
                }}
                disable={grinderOptions.length === 0}
                search={false}
                renderItem={(item, selected) => (
                  <View style={{ 
                    padding: 12, 
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: selected ? themeColors['light-beige'] : 'transparent'
                  }}>
                    <Text style={{ color: themeColors['charcoal'] }}>{item.label}</Text>
                  </View>
                )}
              />
              {grinderOptions.length === 0 && (
                <Text className="text-xs text-cool-gray-green ml-2 mt-1">Add grinders in Settings</Text>
              )}
            </View>
          </View>

          <Divider style={{ marginVertical: 16, backgroundColor: themeColors['pale-gray'], height: 1 }} />       

          <View className="px-4 pt-4 pb-4">
            <RNEButton
              title="Save Brew"
              onPress={handleSaveBrew}
              buttonStyle={{ backgroundColor: themeColors['muted-sage-green'], borderRadius: 8, height: 50 }}
              titleStyle={{ color: themeColors['charcoal'], fontWeight: 'bold' }}
              raised
              disabled={!beanName}
              disabledStyle={{ backgroundColor: themeColors['pale-gray'] }}
              disabledTitleStyle={{ color: themeColors['cool-gray-green'] }}
            />
          </View>

        </Card>
      </ScrollView>
      
      {/* Suggestion Modal */}
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
                Brewing Suggestion for {beanName}
              </Text>
              <TouchableOpacity onPress={() => setSuggestionModalVisible(false)} className="p-1">
                <Icon name="close" type="material" size={24} color="#A8B9AE" />
              </TouchableOpacity>
            </View>
            
            <Divider style={{ marginVertical: 12, backgroundColor: '#E7E7E7' }} />
            
            <ScrollView style={{ maxHeight: 400 }} className="mb-4">
              <Text className="text-base leading-relaxed text-charcoal">
                {suggestion || 'No suggestions available.'}
              </Text>
            </ScrollView>
            
            <Text className="text-sm text-cool-gray-green mb-3 italic">
              Suggested brewing parameters have been pre-filled in the form below. Feel free to adjust them.
            </Text>
            
            <RNEButton
              title="Close and Brew"
              onPress={() => setSuggestionModalVisible(false)}
              buttonStyle={{ backgroundColor: themeColors['muted-sage-green'], borderRadius: 8, paddingVertical: 10 }}
              titleStyle={{ color: themeColors['charcoal'], fontWeight: 'bold' }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default HomeScreenComponent;