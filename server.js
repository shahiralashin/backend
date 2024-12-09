// Import required modules
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');

// Create an Express application
const app = express();
const PORT = 3000; // Port the server will run on

// MongoDB connection URI
const uri = 'mongodb+srv://lashinshahira:SrplydyWA1oljHFT@cluster0.axeh7n5.mongodb.net/webstore';
let db, lessonsCollection, ordersCollection; // Variables to store MongoDB references

//CORS (Cross-Origin Resource Sharing)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");

    next();
})

// Middleware for JSON body parsing
app.use(express.json());


// Middleware to log all incoming requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log('Request Body:', req.body);
    }
    next();
});

// Function to connect to the MongoDB database
async function connectToDB() {
    const startTime = Date.now(); // Record the start time for connection
    try {
        // Establish connection to MongoDB
        const client = await MongoClient.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        // Select the database and collections
        db = client.db('webstore');
        lessonsCollection = db.collection('lessons');
        ordersCollection = db.collection('orders');
        console.log("Connected to MongoDB in", Date.now() - startTime, "ms");
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
        process.exit(1); // Exit process if connection fails
    }
}

// Function to start the server
async function startServer() {
    try {
        await connectToDB(); // Ensure database connection is established
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("Server failed to start:", err);
        process.exit(1); // Exit process if the server fails to start
    }
}

// Serve static files (i.e., images)
app.use('/images', express.static(path.join(__dirname, 'static'), {
    setHeaders: (res, path, stat) => {
        // Check if the requested file exists and is an image
        if (!fs.existsSync(path)) {
            res.status(404).send("Image not found");
        }
        else if (!isImageFile(path)) {
            res.status(415).send("Unsupported image format");
        }
    }
}));

// Helper function to check if a file is an image
function isImageFile(filePath) {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(filePath).toLowerCase();
    return allowedExtensions.includes(ext);
}

// Error handling for image not found
app.use((req, res, next) => {
    // If no route matched for images
    if (req.originalUrl.startsWith('/images') && !fs.existsSync(path.join(__dirname, 'static', req.path))) {
        return res.status(404).send("Image not found");
    }
    next();
});

// Generic error handler for all routes
app.use((err, req, res, next) => {
    console.error(err.stack); // Log error stack trace
    res.status(500).send('Internal Server Error');
});


// API endpoint to retrieve all lessons
app.get('/api/lessons', async (req, res) => {
    try {
        const lessons = await lessonsCollection.find().toArray();
        res.json(lessons); // Send lessons data as JSON response
    } catch (err) {
        res.status(500).send("Error fetching lessons");
    }
});

// API endpoint to add a new lesson
app.post('/api/lessons', async (req, res) => {
    const lesson = req.body; // Extract lesson data from request body
    try {
        await lessonsCollection.insertOne(lesson); // Insert lesson into the database
        res.status(201).json({ message: "Lesson added successfully" });
    } catch (err) {
        res.status(500).send("Error adding lesson");
    }
});

// API endpoint to update a lesson's available spaces
app.put('/api/lessons/:id', async (req, res) => {
    const { id } = req.params; // Extract lesson ID from URL params
    const { availableSpaces } = req.body; // Extract updated spaces from request body

    // Validate the availableSpaces value
    if (typeof availableSpaces !== 'number' || availableSpaces < 0 || !Number.isInteger(availableSpaces)) {
        return res.status(400).json({ error: "Valid availableSpaces (non-negative integer) is required" });
    }

    try {
        // Update the specified lesson in the database
        const result = await lessonsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { availableSpaces } }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ message: "Lesson updated successfully" });
        } else {
            res.status(404).json({ error: "Lesson not found or no changes made" });
        }
    } catch (err) {
        console.error("Error updating lesson:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// API endpoint to place an order
app.post('/api/orders', async (req, res) => {
    const order = req.body; // Extract order details from request body

    // Validate the order data
    if (!order.customerName || !order.cart || order.cart.length === 0) {
        console.error("Invalid order data:", req.body); // Log invalid data
        return res.status(400).json({ error: "Invalid order data" });
    }

    try {
        const result = await ordersCollection.insertOne(order); // Insert order into the database
        res.status(201).json({ message: "Order placed successfully", orderId: result.insertedId });
    } catch (err) {
        console.error("Error saving order:", err);
        res.status(500).send("Error saving order");
    }
});

// API endpoint to retrieve all orders
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await ordersCollection.find().toArray();
        res.json(orders); // Send orders data as JSON response
    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).send("Error fetching orders");
    }
});

// API endpoint to search lessons based on a term
app.get('/api/search', async (req, res) => {
    const searchTerm = req.query.q?.trim(); // Extract and trim search term from query parameters

    try {
        // If no search term is provided, return all lessons
        if (!searchTerm) {
            const allLessons = await lessonsCollection.find().toArray();
            return res.status(200).json(allLessons);
        }

        // Determine if the search term is numeric
        const isNumeric = !isNaN(Number(searchTerm));

        // Perform a search query with regex for partial matching
        const lessons = await lessonsCollection.find({
            $or: [
                { subjectName: { $regex: searchTerm, $options: 'i' } },
                { location: { $regex: searchTerm, $options: 'i' } },
                ...(isNumeric ? [
                    { price: { $regex: searchTerm, $options: 'i' } },
                    { availableSpaces: { $regex: searchTerm, $options: 'i' } },
                    { rating: { $regex: searchTerm, $options: 'i' } }
                ] : [])
            ]
        }).toArray();

        res.status(200).json(lessons); // Return matching lessons as JSON
    } catch (err) {
        console.error("Error searching lessons:", err);
        res.status(500).send("Error searching lessons");
    }
});

// Start the server
startServer();
