import { Request, Response } from 'express';
import { RestaurantModel } from '../models/restaurantModel';
import { S3Service } from '../services/s3Service';

export class RestaurantController {
    private restaurantModel: RestaurantModel;
    private s3Service: S3Service;

    constructor() {
        this.restaurantModel = new RestaurantModel();
        this.s3Service = new S3Service();
    }

    public async addRestaurant(req: Request, res: Response): Promise<void> {
        try {
            const restaurantData = req.body;
            const newRestaurant = await this.restaurantModel.create(restaurantData);
            res.status(201).json(newRestaurant);
        } catch (error) {
            res.status(500).json({ message: 'Error adding restaurant', error });
        }
    }

    public async deleteRestaurant(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            await this.restaurantModel.delete(id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ message: 'Error deleting restaurant', error });
        }
    }

    public async searchRestaurants(req: Request, res: Response): Promise<void> {
        try {
            const { query } = req.query;
            const restaurants = await this.restaurantModel.search(query);
            res.status(200).json(restaurants);
        } catch (error) {
            res.status(500).json({ message: 'Error searching restaurants', error });
        }
    }

    public async getRestaurantPins(req: Request, res: Response): Promise<void> {
        try {
            const pins = await this.restaurantModel.getPins();
            res.status(200).json(pins);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving restaurant pins', error });
        }
    }
}