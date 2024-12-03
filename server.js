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
async function startServer() {
    try {
        await connectToDB(); // Ensure DB connection is established first
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("Server failed to start:", err);
        process.exit(1); // Optional: Exit if the server fails to start
    }
}

// Serve static images from 'frontend/images' folder
app.use('/images', express.static(path.join(__dirname, 'frontend', 'images')));

// API Routes
app.get('/api/lessons', async (req, res) => {
    try {
        const lessons = await lessonsCollection.find().toArray();
        res.json(lessons);
    } catch (err) {
        res.status(500).send("Error fetching lessons");
    }
});

app.post('/api/lessons', async (req, res) => {
    const lesson = req.body;
    try {
        await lessonsCollection.insertOne(lesson);
        res.status(201).json({ message: "Lesson added successfully" });
    } catch (err) {
        res.status(500).send("Error adding lesson");
    }
});

app.put('/api/lessons/:id', async (req, res) => {
    const { id } = req.params;
    const { availableSpaces } = req.body; // Expect the new value of availableSpaces

    if (availableSpaces === undefined || isNaN(availableSpaces)) {
        return res.status(400).json({ error: "Valid availableSpaces value is required" });
    }

    try {
        const result = await lessonsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { availableSpaces } } // Update the availableSpaces field
        );

        if (result.modifiedCount === 1) {
            res.json({ message: "Lesson updated successfully" });
        } else {
            res.status(404).json({ message: "Lesson not found or no changes made" });
        }
    } catch (err) {
        console.error("Error updating lesson:", err);
        res.status(500).send("Error updating lesson");
    }
});


app.post('/api/orders', async (req, res) => {
    const order = req.body;

    // Validate the order data (update to reflect 'cart' instead of 'items')
    if (!order.customerName || !order.cart || order.cart.length === 0) {
        console.error("Invalid order data:", req.body); // Log invalid data
        return res.status(400).json({ error: "Invalid order data" });
    }

    try {
        const result = await ordersCollection.insertOne(order);

        // Return the insertedId from the MongoDB response
        res.status(201).json({ message: "Order placed successfully", orderId: result.insertedId });
    } catch (err) {
        console.error("Error saving order:", err);
        res.status(500).send("Error saving order");
    }
});


app.get('/api/orders', async (req, res) => {
    try {
        const orders = await ordersCollection.find().toArray();
        res.json(orders);
    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).send("Error fetching orders");
    }
});

app.get('/api/search', async (req, res) => {
    const searchTerm = req.query.q?.trim(); // Get and trim search term

    try {
        // If no search term, return all lessons
        if (!searchTerm) {
            const allLessons = await lessonsCollection.find().toArray();
            return res.status(200).json(allLessons);
        }

        // Check if search term is numeric
        const isNumeric = !isNaN(Number(searchTerm));

        // Perform search
        const lessons = await lessonsCollection.find({
            $or: [
                { subjectName: { $regex: searchTerm, $options: 'i' } },
                { location: { $regex: searchTerm, $options: 'i' } },
                ...(isNumeric ? [
                    { price: { $regex: searchTerm, $options: 'i' } }, // Partial match for price as string
                    { availableSpaces: { $regex: searchTerm, $options: 'i' } }, // Partial match for spaces
                    { rating: { $regex: searchTerm, $options: 'i' } } // Partial match for rating
                ] : [])
            ]
        }).toArray();

        res.status(200).json(lessons); // Return matching lessons
    } catch (err) {
        console.error("Error searching lessons:", err);
        res.status(500).send("Error searching lessons");
    }
});



// Serve the frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Handle missing image files with a custom 404 error
app.use('/images/*', (req, res, next) => {
    const imagePath = path.join(__dirname, 'frontend', 'images', req.params[0]);
    
    fs.access(imagePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.status(404).json({ error: "Image not found" });
        } else {
            next();
        }
    });
});

startServer();
