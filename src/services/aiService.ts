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
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a helpful travel assistant that provides detailed and well-structured travel suggestions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 1.3,
        top_p: 0.95,
        max_tokens: 1000,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', errorData);
      throw new Error(errorData.error?.message || `Failed to generate suggestions: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Raw API Response:', data); // Log the raw response for debugging
    
    // Extract the content from the assistant's message
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from API');
    }
    
    return data.choices[0].message.content;
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
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are an inspiring travel assistant that helps people plan their dream trips. You provide creative, detailed, and well-structured suggestions that make travel dreams come true."
          },
          {
            role: "user",
            content: basePrompt
          }
        ],
        temperature: 1.5, // Slightly higher temperature for more creative responses
        top_p: 0.95,
        max_tokens: 1500, // More tokens for detailed dream trip suggestions
        stream: false
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', errorData);
      throw new Error(errorData.error?.message || `Failed to generate dream trip suggestions: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Raw API Response:', data);
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from API');
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating dream trip suggestions:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate dream trip suggestions. Please try again later.');
  }
}; 