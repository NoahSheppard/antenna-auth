const sqlite3 = require('sqlite3').verbose();
const {hashPassword, verifyPassword} = require('./pwd');

function initdb() {
    let db = new sqlite3.Database('./db/users.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.log('Error opening database ' + err.message);
        } else {
            console.log('Connected to the users database.');
        }
    })
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP    
    )`, (err) => {
        if (err) {
            console.error('Error initializing database:', err.message);
        } else {
            console.log('Database initialized successfully');
        }
    });
    return db; 
}

function addUser(db, username, password, email, callback) {
    const sql = `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`;
    db.run(sql, [username, hashPassword(password), email], function(err) {
        if (err) {
            console.log("Error adding user: " + err.message);
            callback(err, 500); 
        } else {
            callback(null, 200);
        }
    })
}

function getUsers(db, callback) {
    db.all(`SELECT * FROM users`, [], (err, rows) => {
        if (err) {
            callback(err, null)
        } else {
            callback(null, rows);
        }
    });
}

module.exports = {
    initdb,
    addUser,
    getUsers
};