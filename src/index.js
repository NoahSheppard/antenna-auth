const express = require('express');
const { initdb } = require('./utils/db');

const app = express();
app.use(express.json());
const PORT = 7910;

const db = initdb();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.get('/initdb', (req, res) => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP    
    )`, (err) => {
        if (err) {
            console.error('Error initializing database:', err.message);
            res.status(500).send('Error initializing database');
        } else {
            console.log('Database initialized successfully');
            res.send('Database initialized successfully');
        }
    });
});