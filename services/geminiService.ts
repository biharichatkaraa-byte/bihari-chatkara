
import { GoogleGenAI, Type } from "@google/genai";
import { MenuItem, Ingredient } from "../types";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMenuInsights = async (
  item: MenuItem,
  ingredients: Ingredient[]
): Promise<{ description: string; dietaryTags: string[]; suggestedPriceRange: string }> => {
  
  if (!process.env.API_KEY) {
    return {
      description: "API Key missing. Please configure environment variables.",
      dietaryTags: [],
      suggestedPriceRange: "N/A"
    };
  }

  const ingredientDetails = item.ingredients.map(ref => {
    const ing = ingredients.find(i => i.id === ref.ingredientId);
    return ing ? `${ref.quantity} ${ing.unit} of ${ing.name}` : 'Unknown ingredient';
  }).join(', ');

  const prompt = `
    You are a professional restaurant consultant and copywriter.
    Analyze the following menu item based on its ingredients:
    
    Item Name: ${item.name}
    Current Price: ₹${item.price} (INR)
    Ingredients: ${ingredientDetails}

    Please provide:
    1. A short, mouth-watering description for a high-end menu (max 2 sentences).
    2. A list of dietary tags (e.g., Gluten-Free, High Protein, Vegan, Contains Dairy).
    3. A suggested price range in Indian Rupees (₹) based on standard restaurant markup (usually 3-4x food cost) and perceived value. Assume the cost provided in ingredients is the raw food cost.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            dietaryTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedPriceRange: { type: Type.STRING },
          },
          required: ["description", "dietaryTags", "suggestedPriceRange"],
        },
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No text response from Gemini");
    }
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      description: "Failed to generate insights.",
      dietaryTags: [],
      suggestedPriceRange: "Error"
    };
  }
};

export const chatWithRestaurantData = async (
  contextData: any,
  userMessage: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "I need a valid API Key to function. Please check your configuration.";
  }

  const systemInstruction = `
    You are 'Bihari Chatkara Co-Pilot', an intelligent restaurant assistant.
    
    CURRENT LIVE RESTAURANT DATA:
    ${JSON.stringify(contextData, null, 2)}
    
    YOUR ROLE:
    1. Answer questions about sales, inventory, and operations based on the data above.
    2. Suggest marketing ideas or recipes if asked.
    3. Be concise, professional, and helpful.
    4. If the data shows issues (e.g., low stock), highlight them proactively.
    5. Currency is INR (₹).
    
    Do not make up data. If you don't find it in the context, say you don't know.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text || "I couldn't process that request.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "I'm having trouble connecting to the AI brain right now.";
  }
};

export const generateChefRecipe = async (
  dishName: string,
  language: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Cannot generate recipe.";
  }

  const prompt = `
    You are a Master Chef at a 5-star restaurant.
    
    Task: Provide a professional, step-by-step recipe for the dish: "${dishName}".
    Language: The output MUST be in ${language} language.
    
    Format:
    1. Ingredients List (with metric measurements).
    2. Step-by-Step Preparation Instructions.
    3. Chef's Tips for plating or flavor enhancement.
    
    Keep it clear, concise, and professional.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate recipe.";
  } catch (error) {
    console.error("Chef Recipe Error:", error);
    return "Sorry, I am unable to access the recipe database right now.";
  }
};