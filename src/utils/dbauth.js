const sqlite3 = require('sqlite3').verbose();
const {hashPassword, genRanHex} = require('./pwd');

/***
 * @returns {sqlite3.Databse} - returns the sqlite3 database instance after initializing it. 
 * @description This should only be ran once at the start of the application to initialize the database.
 */
function initdb() {
    let db = new sqlite3.Database('./db/users.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.log('Error opening database ' + err.message);
        } else {
            //console.log('Connected to the users database.');
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
            //console.log('Database initialized successfully');
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS user_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        key_value TEXT NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE    
    )`, (err) => {
        if (err) {
            console.error(`Error initializing user_keys table: ${err.message}`);
        } else {
            //console.log('user_keys table initialized successfully');
        }
    });

    return db; 
}

/**
 * @param {sqlite3.Database} db - The sqlite3 database instance.
 * @param {string} username - The username of the user to be added.
 * @param {string} password - The password of the user to be added.
 * @param {string} email - The email of the user to be added.
 * @param {function} callback - A callback function to handle the response.
 * @description This function adds a user to the database. It hashes the password before storing it.
 */
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

function verifyUsernameAndPassword(db, username, password, userId, callback) {
    db.all("SELECT * FROM users WHERE username = ? AND password = ?", [username, hashPassword(password)], (err, rows) => {
        if (err) {
            console.log("Error verifying username and password: " + err.message);
            return callback(err, null);
        } 
        
        if (rows.length === 0) {
            return callback(null, null);
        }

        const keyValue = genRanHex(16);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
    
        getUserKeys(db, userId, (err, keyRows) => {
            if (err) {
                console.log('Error retrieving user keys: ' + err.message);
                return callback(err, null);
            }
            
            if (keyRows.length === 0) {
                // No existing keys, create a new one
                addUserKey(db, userId, keyValue, expiresAt, (err, status) => {
                    if (err) {
                        return callback(err, null);
                    } else {
                        return callback(null, keyValue);
                    }
                });
            } else {
                // Return existing key
                return callback(null, keyRows[0].key_value);
            }
        });
    });
}

/**
 * @param {sqlite3.Database} - the db instance 
 * @param {function}  - the callback function 
 * @returns {void} - Callback function returns either error or all rows in the users table.
 */
function getUsers(db, callback) {
    db.all(`SELECT * FROM users`, [], (err, rows) => {
        if (err) {
            callback(err, null)
        } else {
            callback(null, rows);
        }
    });
}

function addUserKey(db, userId, keyValue, expiresAt = null, callback) {
    const sql = `INSERT INTO user_keys (user_id, key_value, expires_at) VALUES (?, ?, ?)`;
    db.run(sql, [userId, keyValue, expiresAt], function(err) {
        if (err) {
            console.log("Error adding user key: " + err.message);
            callback(err, 500);
        } else {
            callback(null, { id: this.lastID, status: 200});
        }
    });
}

function getUserKeys(db, userId, callback) {
    const sql = `SELECT * FROM user_keys WHERE user_id = ? AND is_active = 1`;
    db.all(sql, [userId], (err, rows) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, rows); 
        }
    });
}

function verifyUserKey(db, keyValue, callback) {
    const sql = `
        SELECT uk.*, u.username
        FROM user_keys uk
        JOIN users u ON uk.user_id = u.id
        WHERE uk.key_value = ? AND uk.is_active = 1
        AND (uk.expires_at IS NULL OR uk.expires_at > strftime('%s', 'now') * 1000)
    `;
    db.get(sql, [keyValue], (err, row) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, row);
        }
    });
}

function deactivateUserKey(db, keyValue, callback) {
    const sql = `UPDATE user_keys SET is_active = 0 where key_value = ?`;
    db.run(sql, [keyValue], function(err) {
        if (err) {
            callback(err, 500);
        } else {
            callback(null, {changes: this.changes, status: 200});
        }
    })
}

function getUserIdByUsername(db, username, callback) {
    const sql = `SELECT id FROM users WHERE username = ?`;
    db.get(sql, [username], (err, row) => {
        if (err) {
            console.log("error getting user ID: " + err.message);
            callback(err, null);
        } else if (row) {
            callback(null, row.id);
        } else {
            callback(null, null);
        }
    }); 
}

module.exports = {
    initdb,
    addUser,
    getUsers,
    addUserKey,
    getUserKeys,
    verifyUserKey,
    deactivateUserKey,
    getUserIdByUsername,
    verifyUsernameAndPassword
};