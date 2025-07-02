const express = require('express');
const { 
    initdb, 
    addUser, 
    getUsers, 
    addUserKey,
    getUserKeys,
    verifyUserKey,
    deactivateUserKey,
    getUserIdByUsername 
} = require('./utils/dbauth');
const { genRanHex } = require('./utils/pwd');

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

// Database Endpoints
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

app.get('/getid', (req, res) => {
    getUserIdByUsername(db, req.query.username, (err, userId) => {
        if (err) {
            res.status(500).send('Error retrieving user ID: ' + err.message);
        } else if (userId) {
            res.status(200).send(`User ID: ${userId}`);
        } else {
            res.status(404).send('User not found');
        }
    });
});

app.get('/idtoname', (req, res) => {
    const userId = req.query.id;
    if (!userId) {
        return res.status(400).send("Missing userId!");
    }
    const sql = `SELECT username FROM users WHERE id = ?`;
    db.get(sql, [userId], (err, row) => {
        if (err) {
            res.status(500).send('Error retrieving username: ' + err.message);
        } else if (row) {
            res.status(200).send(`Username: ${row.username}`);
        } else {
            res.status(404).send('User not found');
        }
    });
});

app.get('/addkey', (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).send("Missing userId!");
    }
    
    const keyValue = genRanHex(16);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    addUserKey(db, userId, keyValue, expiresAt, (err, status) => {
        if (err) {
            res.status(500).send("Error adding user key: " + err.message);
        } else {
            res.status(200).send(`Key ${keyValue} added successfully!`);
        }
    });
});

app.get('/getkeys', (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).send("Missing userId!");
    }
    getUserKeys(db, userId, (err, rows) => {
        if (err) {
            res.status(500).send('Error retrieving user keys: ' + err.message);
        } else {
            res.status(200).send(`User Keys: ${JSON.stringify(rows)}`);
        }
    });
});

app.get('/verifykey', (req, res) => {
    const keyValue = req.query.keyValue;
    if (!keyValue) {
        return res.status(400).send("Missing keyValue!");
    }
    verifyUserKey(db, keyValue, (err, row) => {
        if (err) {
            res.status(500).send('Error verifying user key: ' + err.message);
        } else if (row) {
            res.status(200).send(`Key is valid for user: ${row.user_id}`);
        } else {
            res.status(404).send('Key not found or inactive ' + row);
        }
    });
});

app.get('/deactivatekey', (req, res) => {
    const keyValue = req.query.keyValue;
    if (!keyValue) {
        return res.status(400).send("Missing keyValue!");
    }
    deactivateUserKey(db, keyValue, (err, result) => {
        if (err) {
            res.status(500).send('Error deactivating user key: ' + err.message);
        } else if (result.changes > 0) {
            res.status(200).send(`Key ${keyValue} deactivated successfully!`);
        } else {
            res.status(404).send('Key not found or already inactive');
        }
    });
});

// Messaging endpoints