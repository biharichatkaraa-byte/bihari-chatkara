import { MenuItem, Ingredient } from "../types";

// NOTE: AI Features are currently disabled/mocked as per request to remove @google/genai

export const generateMenuInsights = async (
  item: MenuItem,
  ingredients: Ingredient[]
): Promise<{ description: string; dietaryTags: string[]; suggestedPriceRange: string }> => {
  
  // Mock response to simulate AI analysis
  return new Promise((resolve) => {
    setTimeout(() => {
        resolve({
          description: `A delicious serving of ${item.name} prepared with fresh ingredients. (AI Analysis Disabled)`,
          dietaryTags: ["Chef's Special", "Fresh"],
          suggestedPriceRange: `₹${(item.price * 0.9).toFixed(0)} - ₹${(item.price * 1.2).toFixed(0)}`
        });
    }, 1000);
  });
};

export const chatWithRestaurantData = async (
  contextData: any,
  userMessage: string
): Promise<string> => {
    // Mock response
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("I am currently in maintenance mode. AI features are temporarily disabled.");
        }, 800);
    });
};

export const generateChefRecipe = async (
  dishName: string,
  language: string
): Promise<string> => {
  // Mock response
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(`
Recipe for ${dishName} (${language})

** Note: AI Recipe Generation is disabled. **

Standard Operating Procedure:
1. Prepare mis-en-place.
2. Cook according to standard restaurant specification.
3. Garnish and serve hot.
            `);
        }, 1000);
    });
};
