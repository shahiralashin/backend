const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// MongoDB connection URI
const uri = 'mongodb+srv://lashinshahira:SrplydyWA1oljHFT@cluster0.axeh7n5.mongodb.net/webstore';
let db, lessonsCollection, ordersCollection;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Logger middleware (defined once)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log('Request Body:', req.body);
    }
    next();
});

// Connect to MongoDB
async function connectToDB() {
    const startTime = Date.now();
    try {
        const client = await MongoClient.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        db = client.db('webstore');
        lessonsCollection = db.collection('lessons');
        ordersCollection = db.collection('orders');
        console.log("Connected to MongoDB in", Date.now() - startTime, "ms");
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
        process.exit(1); // Exit the process if MongoDB connection fails
    }
}

// Start the server
async function startServer(