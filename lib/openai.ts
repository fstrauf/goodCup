import AsyncStorage from '@react-native-async-storage/async-storage';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '@env';

// Interfaces
export interface Brew {
  id: string;
  timestamp: number;
  beanName: string;
  steepTime: number; // Seconds
  useBloom: boolean;
  bloomTime?: string;
  grindSize: string;
  waterTemp: string;
  rating: number;
  notes: string;
  brewDevice?: string;
  grinder?: string;
}

export interface BrewDevice {
  id: string;
  name: string;
}

export interface Grinder {
  id: string;
  name: string;
}

// Storage keys
const API_KEY_STORAGE_KEY = '@GoodCup:openaiApiKey';
const BREW_DEVICES_KEY = '@GoodCup:brewDevices';
const GRINDERS_KEY = '@GoodCup:grinders';

// Save API key to AsyncStorage
export const saveApiKey = async (apiKey: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  } catch (error) {
    console.error('Error saving API key:', error);
    throw new Error('Failed to save API key');
  }
};

// Get API key from AsyncStorage or env
export const getApiKey = async (): Promise<string | null> => {
  try {
    // First check for env variable
    if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
      return OPENAI_API_KEY;
    }
    
    // If no env variable, check AsyncStorage
    const apiKey = await AsyncStorage.getItem(API_KEY_STORAGE_KEY);
    return apiKey;
  } catch (error) {
    console.error('Error getting API key:', error);
    return null;
  }
};

// Create OpenAI client with API key
export const createOpenAIClient = async (): Promise<OpenAI | null> => {
  const apiKey = await getApiKey();
  if (!apiKey) return null;
  
  return new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Required for React Native
  });
};

// Helper function to format time
const formatTime = (totalSeconds: number): string => {
  if (!totalSeconds || isNaN(totalSeconds)) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// Get brew suggestions from OpenAI API
export const getBrewSuggestions = async (
  currentBrew: Brew,
  previousBrews: Brew[],
  selectedBeanName?: string
): Promise<string> => {
  try {
    // Create OpenAI client
    const openai = await createOpenAIClient();
    if (!openai) {
      return 'No OpenAI API key found. Please set one in the settings.';
    }

    // Get brew devices and grinders
    const storedDevices = await AsyncStorage.getItem(BREW_DEVICES_KEY);
    const storedGrinders = await AsyncStorage.getItem(GRINDERS_KEY);
    
    const brewDevices: BrewDevice[] = storedDevices ? JSON.parse(storedDevices) : [];
    const grinders: Grinder[] = storedGrinders ? JSON.parse(storedGrinders) : [];
    
    // Find current brew device and grinder names
    const brewDeviceName = currentBrew.brewDevice 
      ? brewDevices.find(device => device.id === currentBrew.brewDevice)?.name || 'Unknown'
      : undefined;
      
    const grinderName = currentBrew.grinder
      ? grinders.find(grinder => grinder.id === currentBrew.grinder)?.name || 'Unknown'
      : undefined;
    
    // Determine possible devices and grinders from notes if not specified
    let possibleDevices: string[] = [];
    let possibleGrinders: string[] = [];
    
    if (!brewDeviceName && currentBrew.notes) {
      possibleDevices = brewDevices
        .filter(device => currentBrew.notes.toLowerCase().includes(device.name.toLowerCase()))
        .map(device => device.name);
    }
    
    if (!grinderName && currentBrew.notes) {
      possibleGrinders = grinders
        .filter(grinder => currentBrew.notes.toLowerCase().includes(grinder.name.toLowerCase()))
        .map(grinder => grinder.name);
    }

    // Filter and sort previous brews
    const relevantBrews = previousBrews
      .filter(brew => {
        if (selectedBeanName) {
          return brew.beanName.toLowerCase() === selectedBeanName.toLowerCase();
        }
        return true;
      })
      .sort((a, b) => b.rating - a.rating) // Sort by rating, highest first
      .slice(0, 5); // Take top 5 rated

    // Construct prompt
    let prompt = `As a coffee expert, I'm analyzing a brew of ${currentBrew.beanName}. Here are the details:

Current Brew:
- Steep Time: ${formatTime(currentBrew.steepTime)}
- Grind Size: ${currentBrew.grindSize}
- Water Temperature: ${currentBrew.waterTemp}
${currentBrew.useBloom ? `- Bloom: Yes (${currentBrew.bloomTime || 'unspecified time'})` : '- Bloom: No'}
${brewDeviceName ? `- Brewing Device: ${brewDeviceName}` : ''}
${grinderName ? `- Grinder: ${grinderName}` : ''}
${currentBrew.notes ? `- Notes: ${currentBrew.notes}` : ''}
${currentBrew.rating ? `- Rating: ${currentBrew.rating}/10` : ''}

${possibleDevices.length > 0 ? `Possibly using these brew devices: ${possibleDevices.join(', ')}` : ''}
${possibleGrinders.length > 0 ? `Possibly using these grinders: ${possibleGrinders.join(', ')}` : ''}
`;

    // Add information about previous brews if available
    if (relevantBrews.length > 0) {
      prompt += `\nRelevant previous brews of the same bean (sorted by rating):\n`;
      
      relevantBrews.forEach((brew, index) => {
        prompt += `\nBrew #${index + 1} (Rating: ${brew.rating}/10):
- Steep Time: ${formatTime(brew.steepTime)}
- Grind Size: ${brew.grindSize}
- Water Temperature: ${brew.waterTemp}
${brew.useBloom ? `- Bloom: Yes (${brew.bloomTime || 'unspecified time'})` : '- Bloom: No'}
${brew.notes ? `- Notes: ${brew.notes}` : ''}
`;
      });
    }

    prompt += `\nBased on the current brew and any previous brews of the same bean, please provide concise suggestions to improve the brewing process. Consider these factors:
1. Grind size adjustments
2. Steep time modifications
3. Water temperature changes
4. Bloom technique
5. Any other techniques that might enhance the flavor

Please provide specific, actionable advice that would help achieve a better extraction and flavor profile.`;

    // Call OpenAI with SDK
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0]?.message?.content || 'No suggestions available';
  } catch (error) {
    console.error('Error getting brew suggestions:', error);
    return 'Error getting suggestions. Please try again later.';
  }
};

// Analyze image with vision model
export const analyzeImage = async (base64Image: string): Promise<any> => {
  try {
    // Create OpenAI client
    const openai = await createOpenAIClient();
    if (!openai) {
      throw new Error('No OpenAI API key found. Please set one in the settings.');
    }
    
    // Call vision model with SDK
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'This is a photo of a coffee bean package. Please extract and provide the following information in JSON format:\n' +
                    '1. Bean name\n' +
                    '2. Roaster name\n' +
                    '3. Country/region of origin\n' +
                    '4. Processing method\n' +
                    '5. Roast level\n' +
                    '6. Flavor notes (as an array of strings)\n' +
                    '7. Description\n\n' +
                    'If you cannot determine any field, use "Unknown" or an empty array for flavor notes. Return ONLY valid JSON with these fields.'
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });
    
    const content = response.choices[0]?.message?.content;
    
    if (content) {
      // Extract JSON from the response (handling potential text before or after JSON)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      return JSON.parse(jsonString);
    }
    
    throw new Error('No content returned from OpenAI');
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
}; 