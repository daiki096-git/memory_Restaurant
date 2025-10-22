import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../services/dbService';

export class Restaurant extends Model {
    public id!: number;
    public name!: string;
    public address!: string;
    public phoneNumber!: string;
    public createdAt!: Date;
    public updatedAt!: Date;
}

export class RestaurantPhoto extends Model {
    public id!: number;
    public restaurantId!: number;
    public photoUrl!: string;
    public createdAt!: Date;
    public updatedAt!: Date;
}

Restaurant.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    sequelize,
    tableName: 'restaurants',
});

RestaurantPhoto.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    restaurantId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    photoUrl: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    sequelize,
    tableName: 'restaurant_photos',
});