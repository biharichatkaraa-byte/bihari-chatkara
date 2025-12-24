import { GoogleGenAI, Type } from "@google/genai";
import { MenuItem, Ingredient } from "../types";

// The API key is obtained exclusively from the environment variable process.env.API_KEY
// The bundler (Vite) replaces this with a string literal during build.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates culinary insights for a menu item using Gemini 3 Flash.
 */
export const generateMenuInsights = async (
  item: MenuItem,
  ingredients: Ingredient[]
): Promise<{ description: string; dietaryTags: string[]; suggestedPriceRange: string }> => {
  const prompt = `Analyze this menu item for "Bihari Chatkara" restaurant:
  Name: ${item.name}
  Base Price: ₹${item.price}
  Current Description: ${item.description || "N/A"}
  Ingredients List: ${item.ingredients.map(ingRef => {
    const ing = ingredients.find(i => i.id === ingRef.ingredientId);
    return `${ing?.name || "Unknown"} (${ingRef.quantity} ${ing?.unit || ""})`;
  }).join(", ")}
  
  Provide a professional culinary analysis for a high-quality Bihari restaurant.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { 
            type: Type.STRING, 
            description: "A professional and appetizing description for the menu." 
          },
          dietaryTags: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Relevant dietary tags like 'Spicy', 'Vegan', 'Chef Special'."
          },
          suggestedPriceRange: { 
            type: Type.STRING, 
            description: "Competitive price range suggestion in INR (₹)." 
          }
        },
        required: ["description", "dietaryTags", "suggestedPriceRange"],
        propertyOrdering: ["description", "dietaryTags", "suggestedPriceRange"]
      }
    }
  });

  try {
    // Accessing response.text as a property, not a method, as per guidelines.
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini Response Parsing Error:", e);
    return {
      description: `A signature ${item.name} featuring premium ingredients and authentic Bihari spices.`,
      dietaryTags: ["Chef's Special", "Authentic"],
      suggestedPriceRange: `₹${(item.price * 0.95).toFixed(0)} - ₹${(item.price * 1.15).toFixed(0)}`
    };
  }
};

/**
 * Co-pilot chat assistant for operational insights based on restaurant context data.
 */
export const chatWithRestaurantData = async (
  contextData: any,
  userMessage: string
): Promise<string> => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context (Orders, Inventory, Staff): ${JSON.stringify(contextData)}
      
      User Message: ${userMessage}`,
      config: {
        systemInstruction: "You are the AI Restaurant Co-Pilot for 'Bihari Chatkara'. You assist the manager and staff with real-time operational insights, sales analysis, and inventory optimization. Be brief, professional, and helpful."
      }
    });

    return response.text || "I'm sorry, I'm currently unable to process your request.";
};

/**
 * Generates detailed recipes for chefs using Gemini 3 Pro.
 */
export const generateChefRecipe = async (
  dishName: string,
  language: string
): Promise<string> => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Generate a detailed professional restaurant recipe for "${dishName}" in ${language}. 
      Focus on high-volume consistency and authentic Bihari flavor profiles. 
      Include Mise-en-place, precise steps, and Chef's secrets.`,
      config: {
        thinkingConfig: { thinkingBudget: 2000 }
      }
    });

    return response.text || "Recipe generation failed.";
};