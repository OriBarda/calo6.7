import { PrismaClient } from '@prisma/client';
import { OpenAI } from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MealPlanRequest {
  userId: string;
  targetCalories: number;
  dietaryRestrictions?: string[];
  preferences?: string[];
  duration?: number; // days
}

export interface MealPlanResponse {
  id: string;
  userId: string;
  targetCalories: number;
  duration: number;
  meals: DailyMealPlan[];
  createdAt: Date;
}

export interface DailyMealPlan {
  day: number;
  date: string;
  meals: {
    breakfast: MealSuggestion;
    lunch: MealSuggestion;
    dinner: MealSuggestion;
    snacks?: MealSuggestion[];
  };
  totalCalories: number;
}

export interface MealSuggestion {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  ingredients: string[];
  instructions?: string[];
  prepTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface RecommendedMenu {
  id: string;
  name: string;
  description: string;
  meals: MealSuggestion[];
  totalCalories: number;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  prepTime: number;
}

class MealPlanService {
  async generateMealPlan(request: MealPlanRequest): Promise<MealPlanResponse> {
    try {
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: request.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const duration = request.duration || 7;
      const dailyCalories = request.targetCalories;

      // Generate AI-powered meal suggestions
      const mealPlanPrompt = this.createMealPlanPrompt(request);
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a professional nutritionist. Generate detailed meal plans with accurate nutritional information."
          },
          {
            role: "user",
            content: mealPlanPrompt
          }
        ],
        temperature: 0.7,
      });

      const mealPlanData = this.parseMealPlanResponse(aiResponse.choices[0].message.content || '');
      
      // Create meal plan in database
      const mealPlan = await prisma.mealPlan.create({
        data: {
          userId: request.userId,
          targetCalories: request.targetCalories,
          duration: duration,
          dietaryRestrictions: request.dietaryRestrictions || [],
          preferences: request.preferences || [],
          meals: mealPlanData.meals,
        }
      });

      return {
        id: mealPlan.id,
        userId: mealPlan.userId,
        targetCalories: mealPlan.targetCalories,
        duration: mealPlan.duration,
        meals: mealPlanData.meals,
        createdAt: mealPlan.createdAt,
      };
    } catch (error) {
      console.error('Error generating meal plan:', error);
      throw new Error('Failed to generate meal plan');
    }
  }

  async getRecommendedMenus(userId: string, filters?: {
    difficulty?: string;
    maxCalories?: number;
    dietaryRestrictions?: string[];
  }): Promise<RecommendedMenu[]> {
    try {
      // Get user preferences
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate recommended menus based on user profile and filters
      const menuPrompt = this.createRecommendedMenuPrompt(user, filters);
      
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a professional chef and nutritionist. Generate diverse, healthy meal recommendations with accurate nutritional information in JSON format."
          },
          {
            role: "user",
            content: menuPrompt
          }
        ],
        temperature: 0.8,
      });

      const menusData = this.parseRecommendedMenusResponse(aiResponse.choices[0].message.content || '');
      
      // Store recommended menus in cache/database for future use
      await this.cacheRecommendedMenus(userId, menusData);

      return menusData;
    } catch (error) {
      console.error('Error getting recommended menus:', error);
      // Return fallback menus if AI fails
      return this.getFallbackMenus();
    }
  }

  async getMealPlan(userId: string, mealPlanId: string): Promise<MealPlanResponse | null> {
    try {
      const mealPlan = await prisma.mealPlan.findFirst({
        where: {
          id: mealPlanId,
          userId: userId
        }
      });

      if (!mealPlan) {
        return null;
      }

      return {
        id: mealPlan.id,
        userId: mealPlan.userId,
        targetCalories: mealPlan.targetCalories,
        duration: mealPlan.duration,
        meals: mealPlan.meals as DailyMealPlan[],
        createdAt: mealPlan.createdAt,
      };
    } catch (error) {
      console.error('Error getting meal plan:', error);
      throw new Error('Failed to get meal plan');
    }
  }

  async getUserMealPlans(userId: string): Promise<MealPlanResponse[]> {
    try {
      const mealPlans = await prisma.mealPlan.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return mealPlans.map(plan => ({
        id: plan.id,
        userId: plan.userId,
        targetCalories: plan.targetCalories,
        duration: plan.duration,
        meals: plan.meals as DailyMealPlan[],
        createdAt: plan.createdAt,
      }));
    } catch (error) {
      console.error('Error getting user meal plans:', error);
      throw new Error('Failed to get meal plans');
    }
  }

  private createMealPlanPrompt(request: MealPlanRequest): string {
    const restrictions = request.dietaryRestrictions?.join(', ') || 'none';
    const preferences = request.preferences?.join(', ') || 'none';
    
    return `Generate a ${request.duration || 7}-day meal plan for ${request.targetCalories} calories per day.
    
Dietary restrictions: ${restrictions}
Preferences: ${preferences}

Please provide a detailed meal plan in JSON format with the following structure:
{
  "meals": [
    {
      "day": 1,
      "date": "2024-01-01",
      "meals": {
        "breakfast": {
          "name": "Meal name",
          "description": "Brief description",
          "calories": 400,
          "protein": 20,
          "carbs": 45,
          "fat": 15,
          "fiber": 8,
          "ingredients": ["ingredient1", "ingredient2"],
          "instructions": ["step1", "step2"],
          "prepTime": 15,
          "difficulty": "easy"
        },
        "lunch": { ... },
        "dinner": { ... },
        "snacks": [{ ... }]
      },
      "totalCalories": ${request.targetCalories}
    }
  ]
}

Ensure each day's meals total approximately ${request.targetCalories} calories and include balanced macronutrients.`;
  }

  private createRecommendedMenuPrompt(user: any, filters?: any): string {
    const difficulty = filters?.difficulty || 'any';
    const maxCalories = filters?.maxCalories || 2000;
    const restrictions = filters?.dietaryRestrictions?.join(', ') || 'none';

    return `Generate 6 diverse recommended meal menus for a user with the following preferences:
    
Difficulty level: ${difficulty}
Max calories per menu: ${maxCalories}
Dietary restrictions: ${restrictions}

Please provide recommendations in JSON format:
{
  "menus": [
    {
      "id": "menu-1",
      "name": "Mediterranean Delight",
      "description": "Fresh Mediterranean flavors with healthy fats",
      "meals": [
        {
          "name": "Greek Salad Bowl",
          "description": "Fresh vegetables with feta and olive oil",
          "calories": 350,
          "protein": 15,
          "carbs": 25,
          "fat": 20,
          "fiber": 8,
          "ingredients": ["mixed greens", "feta cheese", "olives"],
          "instructions": ["Combine ingredients", "Drizzle with olive oil"],
          "prepTime": 10,
          "difficulty": "easy"
        }
      ],
      "totalCalories": 1800,
      "tags": ["mediterranean", "healthy", "fresh"],
      "difficulty": "easy",
      "prepTime": 45
    }
  ]
}

Make each menu unique with different cuisines and cooking styles.`;
  }

  private parseMealPlanResponse(response: string): { meals: DailyMealPlan[] } {
    try {
      const parsed = JSON.parse(response);
      return parsed;
    } catch (error) {
      console.error('Error parsing meal plan response:', error);
      // Return fallback meal plan
      return this.getFallbackMealPlan();
    }
  }

  private parseRecommendedMenusResponse(response: string): RecommendedMenu[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.menus || [];
    } catch (error) {
      console.error('Error parsing recommended menus response:', error);
      return this.getFallbackMenus();
    }
  }

  private async cacheRecommendedMenus(userId: string, menus: RecommendedMenu[]): Promise<void> {
    try {
      // Store in database cache table or Redis if available
      await prisma.menuCache.upsert({
        where: { userId },
        update: {
          menus: menus,
          updatedAt: new Date()
        },
        create: {
          userId,
          menus: menus
        }
      });
    } catch (error) {
      console.error('Error caching recommended menus:', error);
      // Non-critical error, continue without caching
    }
  }

  private getFallbackMealPlan(): { meals: DailyMealPlan[] } {
    return {
      meals: [
        {
          day: 1,
          date: new Date().toISOString().split('T')[0],
          meals: {
            breakfast: {
              name: "Oatmeal with Berries",
              description: "Healthy start to your day",
              calories: 350,
              protein: 12,
              carbs: 65,
              fat: 8,
              fiber: 10,
              ingredients: ["oats", "mixed berries", "almond milk"],
              instructions: ["Cook oats", "Add berries", "Serve hot"],
              prepTime: 10,
              difficulty: "easy"
            },
            lunch: {
              name: "Grilled Chicken Salad",
              description: "Protein-rich salad",
              calories: 450,
              protein: 35,
              carbs: 20,
              fat: 25,
              fiber: 8,
              ingredients: ["chicken breast", "mixed greens", "olive oil"],
              instructions: ["Grill chicken", "Prepare salad", "Combine"],
              prepTime: 20,
              difficulty: "medium"
            },
            dinner: {
              name: "Salmon with Vegetables",
              description: "Omega-3 rich dinner",
              calories: 500,
              protein: 40,
              carbs: 30,
              fat: 25,
              fiber: 12,
              ingredients: ["salmon fillet", "broccoli", "sweet potato"],
              instructions: ["Bake salmon", "Steam vegetables", "Serve"],
              prepTime: 25,
              difficulty: "medium"
            }
          },
          totalCalories: 1300
        }
      ]
    };
  }

  private getFallbackMenus(): RecommendedMenu[] {
    return [
      {
        id: "fallback-1",
        name: "Quick & Healthy",
        description: "Simple meals for busy days",
        meals: [
          {
            name: "Avocado Toast",
            description: "Nutritious breakfast option",
            calories: 300,
            protein: 12,
            carbs: 35,
            fat: 18,
            fiber: 10,
            ingredients: ["whole grain bread", "avocado", "eggs"],
            instructions: ["Toast bread", "Mash avocado", "Top with egg"],
            prepTime: 10,
            difficulty: "easy"
          }
        ],
        totalCalories: 1500,
        tags: ["quick", "healthy", "easy"],
        difficulty: "easy",
        prepTime: 30
      }
    ];
  }
}

export const mealPlanService = new MealPlanService();