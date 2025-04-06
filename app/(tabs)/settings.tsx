import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, FlatList, RefreshControl, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Text, Divider, Input, Button } from '@rneui/themed';
import { saveApiKey, getApiKey } from '@/lib/openai';
import { Icon } from '@rneui/base';

// Storage keys
const BREW_DEVICES_STORAGE_KEY = '@GoodCup:brewDevices';
const GRINDERS_STORAGE_KEY = '@GoodCup:grinders';
const DEFAULT_BREW_DEVICE_KEY = '@GoodCup:defaultBrewDevice';
const DEFAULT_GRINDER_KEY = '@GoodCup:defaultGrinder';

// Interfaces
interface BrewDevice {
  id: string;
  name: string;
  type: string;
  notes?: string;
}

interface Grinder {
  id: string;
  name: string;
  type: string;
  notes?: string;
}

export default function SettingsScreen() {
  // OpenAI state
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState(true);
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  
  // Brew devices state
  const [brewDevices, setBrewDevices] = useState<BrewDevice[]>([]);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('');
  const [newDeviceNotes, setNewDeviceNotes] = useState('');
  
  // Grinders state
  const [grinders, setGrinders] = useState<Grinder[]>([]);
  const [newGrinderName, setNewGrinderName] = useState('');
  const [newGrinderType, setNewGrinderType] = useState('');
  const [newGrinderNotes, setNewGrinderNotes] = useState('');
  
  // UI state
  const [addingDevice, setAddingDevice] = useState(false);
  const [addingGrinder, setAddingGrinder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Inside the component, add state for default selections
  const [defaultBrewDevice, setDefaultBrewDevice] = useState<string>('');
  const [defaultGrinder, setDefaultGrinder] = useState<string>('');

  // Load data
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      // Load API Key
      const storedApiKey = await getApiKey();
      setSavedApiKey(storedApiKey);
      
      // Load brew devices
      const storedDevices = await AsyncStorage.getItem(BREW_DEVICES_STORAGE_KEY);
      if (storedDevices !== null) {
        setBrewDevices(JSON.parse(storedDevices));
      } else {
        // Default devices if none exist
        const defaultDevices: BrewDevice[] = [
          { id: '1', name: 'Hario Switch', type: 'Immersion/Pour Over', notes: 'Versatile brewer with ability to switch between immersion and pour over' },
          { id: '2', name: 'Aeropress', type: 'Immersion/Pressure', notes: 'Portable coffee maker with clean cup' }
        ];
        setBrewDevices(defaultDevices);
        await AsyncStorage.setItem(BREW_DEVICES_STORAGE_KEY, JSON.stringify(defaultDevices));
      }

      // Load grinders
      const storedGrinders = await AsyncStorage.getItem(GRINDERS_STORAGE_KEY);
      if (storedGrinders !== null) {
        setGrinders(JSON.parse(storedGrinders));
      } else {
        // Default grinders if none exist
        const defaultGrinders: Grinder[] = [
          { id: '1', name: '1Zpresso J-Max', type: 'Hand Grinder', notes: 'Premium hand grinder with 409 click adjustment' },
          { id: '2', name: 'Baratza Encore', type: 'Electric Grinder', notes: 'Entry-level electric burr grinder' }
        ];
        setGrinders(defaultGrinders);
        await AsyncStorage.setItem(GRINDERS_STORAGE_KEY, JSON.stringify(defaultGrinders));
      }

      // Load default selections
      const defaultDevice = await AsyncStorage.getItem(DEFAULT_BREW_DEVICE_KEY);
      if (defaultDevice) {
        setDefaultBrewDevice(defaultDevice);
      }
      
      const defaultGrinder = await AsyncStorage.getItem(DEFAULT_GRINDER_KEY);
      if (defaultGrinder) {
        setDefaultGrinder(defaultGrinder);
      }
    } catch (e) {
      console.error('Failed to load settings data', e);
    }
    setRefreshing(false);
  }, []);

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Save API Key
  const handleSaveApiKey = async () => {
    try {
      await saveApiKey(apiKey);
      setSavedApiKey(apiKey);
      setApiKey('');
      Alert.alert('Success', 'API key saved successfully.');
    } catch (error) {
      console.error('Error saving API key:', error);
      Alert.alert('Error', 'Failed to save API key. Please try again.');
    }
  };

  // Remove API Key
  const handleRemoveApiKey = async () => {
    try {
      await saveApiKey('');
      setSavedApiKey(null);
      setApiKey('');
      Alert.alert('Success', 'API key removed successfully.');
    } catch (error) {
      console.error('Error removing API key:', error);
      Alert.alert('Error', 'Failed to remove API key. Please try again.');
    }
  };

  // Add new brew device
  const addBrewDevice = async () => {
    if (!newDeviceName || !newDeviceType) return;
    
    const newDevice: BrewDevice = {
      id: Date.now().toString(),
      name: newDeviceName,
      type: newDeviceType,
      notes: newDeviceNotes || undefined
    };
    
    const updatedDevices = [...brewDevices, newDevice];
    setBrewDevices(updatedDevices);
    await AsyncStorage.setItem(BREW_DEVICES_STORAGE_KEY, JSON.stringify(updatedDevices));
    
    // Reset form
    setNewDeviceName('');
    setNewDeviceType('');
    setNewDeviceNotes('');
    setAddingDevice(false);
  };

  // Add new grinder
  const addGrinder = async () => {
    if (!newGrinderName || !newGrinderType) return;
    
    const newGrinder: Grinder = {
      id: Date.now().toString(),
      name: newGrinderName,
      type: newGrinderType,
      notes: newGrinderNotes || undefined
    };
    
    const updatedGrinders = [...grinders, newGrinder];
    setGrinders(updatedGrinders);
    await AsyncStorage.setItem(GRINDERS_STORAGE_KEY, JSON.stringify(updatedGrinders));
    
    // Reset form
    setNewGrinderName('');
    setNewGrinderType('');
    setNewGrinderNotes('');
    setAddingGrinder(false);
  };

  // Delete brew device
  const handleRemoveBrewDevice = async (id: string) => {
    try {
      const updatedDevices = brewDevices.filter(device => device.id !== id);
      setBrewDevices(updatedDevices);
      await AsyncStorage.setItem(BREW_DEVICES_STORAGE_KEY, JSON.stringify(updatedDevices));
      
      // If default device is removed, clear the default
      if (defaultBrewDevice === id) {
        await AsyncStorage.removeItem(DEFAULT_BREW_DEVICE_KEY);
        setDefaultBrewDevice('');
      }
    } catch (error) {
      console.error('Error removing brew device:', error);
      Alert.alert('Error', 'Failed to remove brew device.');
    }
  };

  // Delete grinder
  const handleRemoveGrinder = async (id: string) => {
    try {
      const updatedGrinders = grinders.filter(grinder => grinder.id !== id);
      setGrinders(updatedGrinders);
      await AsyncStorage.setItem(GRINDERS_STORAGE_KEY, JSON.stringify(updatedGrinders));
      
      // If default grinder is removed, clear the default
      if (defaultGrinder === id) {
        await AsyncStorage.removeItem(DEFAULT_GRINDER_KEY);
        setDefaultGrinder('');
      }
    } catch (error) {
      console.error('Error removing grinder:', error);
      Alert.alert('Error', 'Failed to remove grinder.');
    }
  };

  // Add functions to set defaults
  const setAsDefaultBrewDevice = async (id: string) => {
    try {
      await AsyncStorage.setItem(DEFAULT_BREW_DEVICE_KEY, id);
      setDefaultBrewDevice(id);
      Alert.alert('Success', 'Default brew device set successfully.');
    } catch (error) {
      console.error('Error setting default brew device:', error);
      Alert.alert('Error', 'Failed to set default brew device.');
    }
  };

  const setAsDefaultGrinder = async (id: string) => {
    try {
      await AsyncStorage.setItem(DEFAULT_GRINDER_KEY, id);
      setDefaultGrinder(id);
      Alert.alert('Success', 'Default grinder set successfully.');
    } catch (error) {
      console.error('Error setting default grinder:', error);
      Alert.alert('Error', 'Failed to set default grinder.');
    }
  };

  // Render brew device item
  const renderBrewDeviceItem = ({ item }: { item: BrewDevice }) => (
    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={{ flex: 1, fontSize: 16 }}>{item.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {defaultBrewDevice === item.id && (
          <View style={{ 
            backgroundColor: '#4caf50', 
            paddingHorizontal: 8, 
            paddingVertical: 2, 
            borderRadius: 12, 
            marginRight: 10 
          }}>
            <Text style={{ color: 'white', fontSize: 12 }}>Default</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={() => setAsDefaultBrewDevice(item.id)}
          style={{ marginRight: 10 }}
        >
          <Icon name="star" type="material" size={24} color={defaultBrewDevice === item.id ? '#ffc107' : '#e0e0e0'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleRemoveBrewDevice(item.id)}>
          <Icon name="delete" type="material" size={24} color="#f44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render grinder item
  const renderGrinderItem = ({ item }: { item: Grinder }) => (
    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={{ flex: 1, fontSize: 16 }}>{item.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {defaultGrinder === item.id && (
          <View style={{ 
            backgroundColor: '#4caf50', 
            paddingHorizontal: 8, 
            paddingVertical: 2, 
            borderRadius: 12, 
            marginRight: 10 
          }}>
            <Text style={{ color: 'white', fontSize: 12 }}>Default</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={() => setAsDefaultGrinder(item.id)}
          style={{ marginRight: 10 }}
        >
          <Icon name="star" type="material" size={24} color={defaultGrinder === item.id ? '#ffc107' : '#e0e0e0'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleRemoveGrinder(item.id)}>
          <Icon name="delete" type="material" size={24} color="#f44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <ScrollView
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        >
          <Text style={{ fontSize: 24, fontWeight: '600', color: '#333', marginBottom: 16, marginTop: 8 }}>Settings</Text>
          
          {/* OpenAI API Key Section */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 }}>
              Brew Suggestions (OpenAI)
            </Text>
            <Card containerStyle={{
              borderRadius: 10,
              padding: 16,
              elevation: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              marginBottom: 0
            }}>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
                Enter your OpenAI API key to get AI-powered suggestions for improving your coffee brews.
              </Text>
              
              <Input
                placeholder="Enter OpenAI API Key"
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry={apiKeyMasked}
                rightIcon={{
                  type: 'ionicon',
                  name: apiKeyMasked ? 'eye-off-outline' : 'eye-outline',
                  onPress: () => setApiKeyMasked(!apiKeyMasked)
                }}
                containerStyle={{ paddingHorizontal: 0 }}
                inputContainerStyle={{ 
                  borderWidth: 1, 
                  borderColor: '#e1e1e1', 
                  borderRadius: 8, 
                  paddingHorizontal: 10 
                }}
              />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 14, color: '#666' }}>
                  Status: {savedApiKey ? 'API Key Saved ✓' : 'No API Key Saved'}
                </Text>
                {savedApiKey && (
                  <TouchableOpacity onPress={handleRemoveApiKey}>
                    <Text style={{ color: '#ff6b6b', fontSize: 14 }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <Button
                title="Save API Key"
                onPress={handleSaveApiKey}
                disabled={!apiKey}
                buttonStyle={{ 
                  borderRadius: 8, 
                  marginTop: 16,
                  backgroundColor: '#2089dc' 
                }}
              />
              
              <Text style={{ fontSize: 12, color: '#888', marginTop: 12, textAlign: 'center' }}>
                Your API key is stored securely on your device only.
              </Text>
            </Card>
          </View>
          
          <Divider style={{ marginBottom: 24 }} />
          
          {/* Brew Devices Section */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#333' }}>Brew Devices</Text>
              {!addingDevice ? (
                <TouchableOpacity onPress={() => setAddingDevice(true)}>
                  <Text style={{ color: '#2089dc', fontSize: 14 }}>Add Device</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            
            {addingDevice ? (
              <Card containerStyle={{
                borderRadius: 10,
                padding: 16,
                marginBottom: 16,
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2
              }}>
                <Input
                  placeholder="Device Name (e.g., Hario Switch)"
                  value={newDeviceName}
                  onChangeText={setNewDeviceName}
                  containerStyle={{ paddingHorizontal: 0 }}
                  inputContainerStyle={{ 
                    borderWidth: 1, 
                    borderColor: '#e1e1e1', 
                    borderRadius: 8, 
                    paddingHorizontal: 10 
                  }}
                />
                <Input
                  placeholder="Device Type (e.g., Pour Over)"
                  value={newDeviceType}
                  onChangeText={setNewDeviceType}
                  containerStyle={{ paddingHorizontal: 0 }}
                  inputContainerStyle={{ 
                    borderWidth: 1, 
                    borderColor: '#e1e1e1', 
                    borderRadius: 8, 
                    paddingHorizontal: 10 
                  }}
                />
                <Input
                  placeholder="Notes (optional)"
                  value={newDeviceNotes}
                  onChangeText={setNewDeviceNotes}
                  containerStyle={{ paddingHorizontal: 0 }}
                  inputContainerStyle={{ 
                    borderWidth: 1, 
                    borderColor: '#e1e1e1', 
                    borderRadius: 8, 
                    paddingHorizontal: 10 
                  }}
                  multiline
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                  <Button
                    title="Cancel"
                    type="outline"
                    onPress={() => {
                      setAddingDevice(false);
                      setNewDeviceName('');
                      setNewDeviceType('');
                      setNewDeviceNotes('');
                    }}
                    buttonStyle={{ borderRadius: 8, paddingHorizontal: 16 }}
                  />
                  <Button
                    title="Save"
                    onPress={addBrewDevice}
                    buttonStyle={{ borderRadius: 8, paddingHorizontal: 16 }}
                    disabled={!newDeviceName || !newDeviceType}
                  />
                </View>
              </Card>
            ) : null}
            
            <FlatList
              data={brewDevices}
              renderItem={renderBrewDeviceItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: '#888', marginTop: 16, marginBottom: 16 }}>
                  No brew devices added yet
                </Text>
              }
            />
          </View>
          
          <Divider style={{ marginBottom: 24 }} />
          
          {/* Grinders Section */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#333' }}>Grinders</Text>
              {!addingGrinder ? (
                <TouchableOpacity onPress={() => setAddingGrinder(true)}>
                  <Text style={{ color: '#2089dc', fontSize: 14 }}>Add Grinder</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            
            {addingGrinder ? (
              <Card containerStyle={{
                borderRadius: 10,
                padding: 16,
                marginBottom: 16,
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2
              }}>
                <Input
                  placeholder="Grinder Name (e.g., 1Zpresso J-Max)"
                  value={newGrinderName}
                  onChangeText={setNewGrinderName}
                  containerStyle={{ paddingHorizontal: 0 }}
                  inputContainerStyle={{ 
                    borderWidth: 1, 
                    borderColor: '#e1e1e1', 
                    borderRadius: 8, 
                    paddingHorizontal: 10 
                  }}
                />
                <Input
                  placeholder="Grinder Type (e.g., Hand Grinder)"
                  value={newGrinderType}
                  onChangeText={setNewGrinderType}
                  containerStyle={{ paddingHorizontal: 0 }}
                  inputContainerStyle={{ 
                    borderWidth: 1, 
                    borderColor: '#e1e1e1', 
                    borderRadius: 8, 
                    paddingHorizontal: 10 
                  }}
                />
                <Input
                  placeholder="Notes (optional)"
                  value={newGrinderNotes}
                  onChangeText={setNewGrinderNotes}
                  containerStyle={{ paddingHorizontal: 0 }}
                  inputContainerStyle={{ 
                    borderWidth: 1, 
                    borderColor: '#e1e1e1', 
                    borderRadius: 8, 
                    paddingHorizontal: 10 
                  }}
                  multiline
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                  <Button
                    title="Cancel"
                    type="outline"
                    onPress={() => {
                      setAddingGrinder(false);
                      setNewGrinderName('');
                      setNewGrinderType('');
                      setNewGrinderNotes('');
                    }}
                    buttonStyle={{ borderRadius: 8, paddingHorizontal: 16 }}
                  />
                  <Button
                    title="Save"
                    onPress={addGrinder}
                    buttonStyle={{ borderRadius: 8, paddingHorizontal: 16 }}
                    disabled={!newGrinderName || !newGrinderType}
                  />
                </View>
              </Card>
            ) : null}
            
            <FlatList
              data={grinders}
              renderItem={renderGrinderItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: '#888', marginTop: 16, marginBottom: 16 }}>
                  No grinders added yet
                </Text>
              }
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});
