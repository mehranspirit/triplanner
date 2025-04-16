import { GoogleGenerativeAI } from '@google/generative-ai';

interface AISuggestionRequest {
  places: string[];
  activities: string[];
  startDate: string;
  endDate: string;
}

interface DreamTripSuggestionRequest {
  places: string[];
  activities: string[];
  customPrompt: string;
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

export const generateAISuggestions = async (request: AISuggestionRequest): Promise<string> => {
  const prompt = `Generate travel suggestions for a trip from ${request.startDate} to ${request.endDate}.
Places to visit: ${request.places.join(', ')}
Interested in: ${request.activities.join(', ')}

Please provide detailed suggestions for activities and experiences that would be enjoyable during this trip. Include:
1. Specific attractions or locations to visit
2. Recommended activities based on the interests
3. Tips for timing and duration of activities
4. Any seasonal considerations
5. Practical advice for visiting these places

Format the response in a clear, easy-to-read way with sections and bullet points.`;

  try {
    // Configure generation parameters for more dynamic responses
    const generationConfig = {
      temperature: 0.9,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    };

    // Generate content with Gemini
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;
    const text = response.text();
    
    if (!text) {
      throw new Error('Empty response from AI');
    }
    
    return text;
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate suggestions. Please try again later.');
  }
};

export const generateDreamTripSuggestions = async (request: DreamTripSuggestionRequest): Promise<string> => {
  const basePrompt = `Generate dream trip suggestions based on the following preferences:
Places of interest: ${request.places.join(', ')}
Activities of interest: ${request.activities.join(', ')}

${request.customPrompt ? `Additional requirements: ${request.customPrompt}\n` : ''}
Please provide detailed suggestions for a dream trip that would be perfect for these preferences. Include:
1. Specific destinations and locations that match the interests
2. Unique and memorable activities based on the preferences
3. Best times to visit these places
4. Special experiences or hidden gems
5. Practical tips for planning this dream trip
6. Estimated budget considerations
7. How to make this trip extra special

Format the response in a clear, easy-to-read way with sections and bullet points. Make it inspiring and exciting!`;

  try {
    // Configure generation parameters for more creative responses
    const generationConfig = {
      temperature: 1.0, // Higher temperature for more creative responses
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    };

    // Generate content with Gemini
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: basePrompt }] }],
      generationConfig,
    });

    const response = await result.response;
    const text = response.text();
    
    if (!text) {
      throw new Error('Empty response from AI');
    }
    
    return text;
  } catch (error) {
    console.error('Error generating dream trip suggestions:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate dream trip suggestions. Please try again later.');
  }
}; 