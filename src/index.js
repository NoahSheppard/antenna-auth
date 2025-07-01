const express = require('express');
const { initdb, addUser, getUsers } = require('./utils/db');

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

app.get('/adduser', (req, res) => {
    const { username, password, email } = req.query;
    if (!username || !password || !email) {
        return res.status(400).send("Missing email, password or username!");
    }
    addUser(db, username, password, email, (err, status) => {
        if (err) {
            res.status(500).send("Hey, sorry! Couldn't. Here's why!: " + err.message);
        } else {
            res.status(200).send(`User ${username} added successfully!`);
        }
    })
});

app.get('/getusers', (req, res) => {
    getUsers(db, (err, rows) => {
        if (err) {
            res.status(500).send('Error retrieving users: ' + err.message);
        } else {
            res.status(200).send(`Users: ${JSON.stringify(rows)}`);
        }
    });
});