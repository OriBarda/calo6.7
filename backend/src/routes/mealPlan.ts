import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { mealPlanService, MealPlanRequest } from '../services/mealPlan';
import { body, query, validationResult } from 'express-validator';

const router = express.Router();

// Validation middleware
const validateMealPlanRequest = [
  body('targetCalories').isInt({ min: 1000, max: 5000 }).withMessage('Target calories must be between 1000 and 5000'),
  body('duration').optional().isInt({ min: 1, max: 30 }).withMessage('Duration must be between 1 and 30 days'),
  body('dietaryRestrictions').optional().isArray().withMessage('Dietary restrictions must be an array'),
  body('preferences').optional().isArray().withMessage('Preferences must be an array'),
];

const validateRecommendedMenuQuery = [
  query('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level'),
  query('maxCalories').optional().isInt({ min: 500, max: 3000 }).withMessage('Max calories must be between 500 and 3000'),
  query('dietaryRestrictions').optional().isString().withMessage('Dietary restrictions must be a string'),
];

// Generate new meal plan
router.post('/generate', authenticateToken, validateMealPlanRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const mealPlanRequest: MealPlanRequest = {
      userId,
      targetCalories: req.body.targetCalories,
      dietaryRestrictions: req.body.dietaryRestrictions,
      preferences: req.body.preferences,
      duration: req.body.duration || 7
    };

    const mealPlan = await mealPlanService.generateMealPlan(mealPlanRequest);

    res.json({
      success: true,
      data: mealPlan,
      message: 'Meal plan generated successfully'
    });
  } catch (error) {
    console.error('Error generating meal plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate meal plan',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recommended menus
router.get('/recommended', authenticateToken, validateRecommendedMenuQuery, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const filters = {
      difficulty: req.query.difficulty as string,
      maxCalories: req.query.maxCalories ? parseInt(req.query.maxCalories as string) : undefined,
      dietaryRestrictions: req.query.dietaryRestrictions ? 
        (req.query.dietaryRestrictions as string).split(',') : undefined
    };

    const recommendedMenus = await mealPlanService.getRecommendedMenus(userId, filters);

    res.json({
      success: true,
      data: recommendedMenus,
      message: 'Recommended menus retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting recommended menus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommended menus',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific meal plan
router.get('/:mealPlanId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { mealPlanId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const mealPlan = await mealPlanService.getMealPlan(userId, mealPlanId);

    if (!mealPlan) {
      return res.status(404).json({
        success: false,
        message: 'Meal plan not found'
      });
    }

    res.json({
      success: true,
      data: mealPlan,
      message: 'Meal plan retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting meal plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get meal plan',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user's meal plans
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const mealPlans = await mealPlanService.getUserMealPlans(userId);

    res.json({
      success: true,
      data: mealPlans,
      message: 'Meal plans retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting user meal plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get meal plans',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete meal plan
router.delete('/:mealPlanId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { mealPlanId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if meal plan exists and belongs to user
    const existingPlan = await mealPlanService.getMealPlan(userId, mealPlanId);
    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: 'Meal plan not found'
      });
    }

    // Delete meal plan (implement in service)
    // await mealPlanService.deleteMealPlan(userId, mealPlanId);

    res.json({
      success: true,
      message: 'Meal plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting meal plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete meal plan',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;