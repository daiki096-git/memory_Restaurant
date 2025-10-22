import express from 'express';
import bodyParser from 'body-parser';
import restaurantRoutes from './routes/restaurantRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/restaurants', restaurantRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});