# Restaurant Information Management Application

This project is a restaurant information management application built using TypeScript, Node.js with Express, MySQL, and AWS S3. It allows users to manage restaurant information, including adding, deleting, and searching for restaurants, as well as handling restaurant photos.

## Features

- Add, delete, and search for restaurants
- Upload and manage restaurant photos using AWS S3
- Secure API endpoints with authentication middleware

## Technologies Used

- **TypeScript**: For type safety and better development experience
- **Node.js**: JavaScript runtime for building the server
- **Express**: Web framework for building the API
- **MySQL**: Database for storing restaurant information
- **AWS S3**: Storage service for managing restaurant photos

## Project Structure

```
restaurant-info-app
├── src
│   ├── app.ts
│   ├── controllers
│   │   └── restaurantController.ts
│   ├── routes
│   │   └── restaurantRoutes.ts
│   ├── models
│   │   └── restaurantModel.ts
│   ├── services
│   │   ├── dbService.ts
│   │   └── s3Service.ts
│   ├── middlewares
│   │   └── authMiddleware.ts
│   └── types
│       └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd restaurant-info-app
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Configure your MySQL database and AWS S3 credentials in the environment variables.

5. Start the application:
   ```
   npm start
   ```

## API Endpoints

- `POST /restaurants`: Add a new restaurant
- `DELETE /restaurants/:id`: Delete a restaurant by ID
- `GET /restaurants`: Search for restaurants
- `GET /restaurants/pins`: Get restaurant pins for display

## License

This project is licensed under the MIT License.