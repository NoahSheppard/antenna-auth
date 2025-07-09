const sqlite3 = require('sqlite3').verbose();

function initdb() {
    let db = new sqlite3.Database('./db/messages.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.log('Error opening database ' + err.message);
        } else {
            //console.log('Connected to the users database.');
        }
    })
    db.run(`CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        users TEXT NOT NULL,
        messages TEXT NOT NULL  
    )`, (err) => {
        if (err) {
            console.error('Error initializing database:', err.message);
        } else {
            //console.log('Database initialized successfully');
        }
    });

    return db; 
}

function addMessageToChannel(db, channelId, senderId, message, callback) {
    db.get(`SELECT messages FROM channels WHERE id = ?`, [channelId], (err, row) => {
        if (err) {
            return callback(err);
        }

        let messages = [];
        if (row && row.messages) {
            try {
                messages = JSON.parse(row.messages);
            } catch (e) {
                messages = [];
            }
        }

        const newMessage = {
            id: Date.now(),
            idOfSender: senderId,
            message: message,
            timestamp: new Date().toISOString()
        };

        messages.push(newMessage);

        db.run(`UPDATE channels SET messages = ? WHERE id = ?`, [JSON.stringify(messages), channelId], function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null, newMessage.id);
            }
        });
    });
}

function getUserChannels(db, userId, callback) {
    db.all(`SELECT * FROM channels WHERE users LIKE ?`, [`%${userId}%`], (err, rows) => {
        if (err) {
            return callback(err);
        }

        const userChannels = rows.filter(row => {
            try {
                const users = JSON.parse(row.users);
                //console.log('User ID: ' + userId);
                return users.includes(parseInt(userId));
            } catch (e) {
                return false;
            }
        });

        callback(null, userChannels);
    });
}

function createChannel(db, userIds, callback) {
    const usersJson = JSON.stringify(userIds);
    const messagesJson = JSON.stringify([]);

    db.run(`INSERT INTO channels (users, messages) VALUES (?, ?)`, [usersJson, messagesJson], function(err) {
        if (err) {
            callback(err);
        } else {
            callback(null, this.lastID);
        }
    });
}

function isUserInChannel(db, channelId, userId, callback) {
    db.get(`SELECT users FROM channels WHERE id = ?`, [channelId], [channelId], (err, row) => {
        if (err) {
            return callback(err);
        }
        if (!row) {
            return callback(null, false, 'Channel not found');
        }

        try {
            const channelUsers = JSON.parse(row.users);
            //console.log('User ID: ' + userId);
            const isInChannel = channelUsers.includes(parseInt(userId));
            //console.log('[dbmsg.js] Is user in channel: ' + isInChannel);
            callback(null, isInChannel);
        } catch (e) {
            callback(null, false, 'Invalid channel data response: ' + e.message);
        }
    });
}

module.exports = {
    initdb,
    addMessageToChannel,
    getUserChannels,
    createChannel,
    isUserInChannel
}