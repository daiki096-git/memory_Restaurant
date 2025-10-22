import { Router } from 'express';
import RestaurantController from '../controllers/restaurantController';

const router = Router();
const restaurantController = new RestaurantController();

router.post('/restaurants', restaurantController.addRestaurant);
router.delete('/restaurants/:id', restaurantController.deleteRestaurant);
router.get('/restaurants', restaurantController.searchRestaurants);
router.get('/restaurants/pins', restaurantController.getRestaurantPins);

export default router;