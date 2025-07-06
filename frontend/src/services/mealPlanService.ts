import { apiClient } from './api';

export interface MealPlanRequest {
  targetCalories: number;
  dietaryRestrictions?: string[];
  preferences?: string[];
  duration?: number;
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

export interface MealPlan {
  id: string;
  userId: string;
  targetCalories: number;
  duration: number;
  meals: DailyMealPlan[];
  createdAt: string;
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

export interface RecommendedMenuFilters {
  difficulty?: 'easy' | 'medium' | 'hard';
  maxCalories?: number;
  dietaryRestrictions?: string[];
}

class MealPlanService {
  async generateMealPlan(request: MealPlanRequest): Promise<MealPlan> {
    try {
      const response = await apiClient.post('/meal-plans/generate', request);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to generate meal plan');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error generating meal plan:', error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to generate meal plan'
      );
    }
  }

  async getRecommendedMenus(filters?: RecommendedMenuFilters): Promise<RecommendedMenu[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.difficulty) {
        params.append('difficulty', filters.difficulty);
      }
      
      if (filters?.maxCalories) {
        params.append('maxCalories', filters.maxCalories.toString());
      }
      
      if (filters?.dietaryRestrictions && filters.dietaryRestrictions.length > 0) {
        params.append('dietaryRestrictions', filters.dietaryRestrictions.join(','));
      }

      const response = await apiClient.get(`/meal-plans/recommended?${params.toString()}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get recommended menus');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error getting recommended menus:', error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to get recommended menus'
      );
    }
  }

  async getMealPlan(mealPlanId: string): Promise<MealPlan> {
    try {
      const response = await apiClient.get(`/meal-plans/${mealPlanId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get meal plan');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error getting meal plan:', error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to get meal plan'
      );
    }
  }

  async getUserMealPlans(): Promise<MealPlan[]> {
    try {
      const response = await apiClient.get('/meal-plans');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get meal plans');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error getting user meal plans:', error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to get meal plans'
      );
    }
  }

  async deleteMealPlan(mealPlanId: string): Promise<void> {
    try {
      const response = await apiClient.delete(`/meal-plans/${mealPlanId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete meal plan');
      }
    } catch (error: any) {
      console.error('Error deleting meal plan:', error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to delete meal plan'
      );
    }
  }

  // Utility methods
  calculateDailyNutrition(meals: DailyMealPlan['meals']): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  } {
    const nutrition = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0
    };

    // Add breakfast, lunch, dinner
    [meals.breakfast, meals.lunch, meals.dinner].forEach(meal => {
      nutrition.calories += meal.calories;
      nutrition.protein += meal.protein;
      nutrition.carbs += meal.carbs;
      nutrition.fat += meal.fat;
      nutrition.fiber += meal.fiber;
    });

    // Add snacks if present
    if (meals.snacks) {
      meals.snacks.forEach(snack => {
        nutrition.calories += snack.calories;
        nutrition.protein += snack.protein;
        nutrition.carbs += snack.carbs;
        nutrition.fat += snack.fat;
        nutrition.fiber += snack.fiber;
      });
    }

    return nutrition;
  }

  formatMealPlanForExport(mealPlan: MealPlan): string {
    let output = `Meal Plan - ${mealPlan.duration} Days\n`;
    output += `Target Calories: ${mealPlan.targetCalories}\n\n`;

    mealPlan.meals.forEach(day => {
      output += `Day ${day.day} (${day.date})\n`;
      output += `===================\n`;
      
      output += `Breakfast: ${day.meals.breakfast.name}\n`;
      output += `- ${day.meals.breakfast.description}\n`;
      output += `- Calories: ${day.meals.breakfast.calories}\n\n`;
      
      output += `Lunch: ${day.meals.lunch.name}\n`;
      output += `- ${day.meals.lunch.description}\n`;
      output += `- Calories: ${day.meals.lunch.calories}\n\n`;
      
      output += `Dinner: ${day.meals.dinner.name}\n`;
      output += `- ${day.meals.dinner.description}\n`;
      output += `- Calories: ${day.meals.dinner.calories}\n\n`;
      
      if (day.meals.snacks && day.meals.snacks.length > 0) {
        output += `Snacks:\n`;
        day.meals.snacks.forEach((snack, index) => {
          output += `${index + 1}. ${snack.name} - ${snack.calories} calories\n`;
        });
        output += '\n';
      }
      
      output += `Total Calories: ${day.totalCalories}\n\n`;
    });

    return output;
  }
}

export const mealPlanService = new MealPlanService();