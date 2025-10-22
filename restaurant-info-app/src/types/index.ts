export interface Restaurant {
    id: number;
    name: string;
    address: string;
    phone: string;
    cuisine: string;
    rating: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface RestaurantPhoto {
    id: number;
    restaurantId: number;
    url: string;
    createdAt: Date;
    updatedAt: Date;
}