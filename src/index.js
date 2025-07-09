const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
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
const dbmsg = require('./utils/dbmsg');
const { 
    addMessageToChannel, 
    getUserChannels, 
    createChannel, 
    isUserInChannel 
} = require('./utils/dbmsg');

const app = express();

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // fix in prod
        methods: ["GET", "POST"]
    }
});

app.use(express.json());
const PORT = 7910;

const db = initdb();
const msgdb = dbmsg.initdb();

const userSockets = new Map(); // userId -> socketId

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m'; // Resets text formatting to default

io.on('connection', (socket) => {
    console.log("User connected: " + socket.id);

    socket.on('authenticate', (data) => {
        const { userId, keyValue } = data;

        verifyUserKey(db, keyValue, (err, row) => {
            if (err || !row) {
                socket.emit('auth_error', 'Invalid Authentication');
                return;
            }

            userSockets.set(userId, socket.id);
            socket.userId = userId;

            console.log(`User ${userId} authenticated`);
            socket.emit('authenticated', { userId });
        });
    });

    socket.on('join_channel', (channelId) => {
        const userId = socket.userId;

        if (!userId) {
            socket.emit('error', 'not authenticated');
            return;
        }

        isUserInChannel(msgdb, channelId, userId, (err, isInChannel, errorMessage) => {
            if (err) {
                socket.emit('error', 'Database error: ' + err.message);
                return;
            }
            
            //console.log(`User ${userId} is in channel ${channelId}: ${isInChannel ? GREEN : RED}${isInChannel}${RESET}`);
            
            if (!isInChannel) {
                socket.emit('error', errorMessage || 'You are not a member of this channel');
                return;
            }

            socket.join(`channel_${channelId}`);
            socket.emit('joined_channel', { channelId });
        })
    })

    socket.on('send_message', (data) => {
        const {channelId, message } = data;
        const senderId = socket.userId;
        //console.log(`User ${senderId} sending message to channel ${channelId}: ${message}`);

        if (!senderId) {
            socket.emit('error', 'Not authenticated');
            return;
        }

        isUserInChannel(msgdb, channelId, senderId, (err, isInChannel, errorMessage) => {
            if (err) {
                socket.emit('error', 'Database error: ' + err.message);
                return;
            }
            
            //console.log(`User ${senderId} is in channel ${channelId}: ${isInChannel ? GREEN : RED}${isInChannel}${RESET}`);
            
            if (!isInChannel) {
                socket.emit('error', errorMessage || 'You are not a member of this channel');
            } else {
                console.log(`Sending message to channel ${channelId} from user ${senderId}: ${message}`);
                addMessageToChannel(msgdb, channelId, senderId, message, (err, messageId) => {
                    if (err) {
                        socket.emit('error', 'Failed to send message: ' + err.message);
                        return;
                    }

                    const messageData = {
                        id: messageId,
                        channelId,
                        senderId,
                        message,
                        timestamp: new Date().toISOString()
                    }

                    io.to(`channel_${channelId}`).emit('new_message', messageData);
                    console.log(`Message sent to channel ${channelId}: ${message}`);
                });
            }
            //console.log(`User ${senderId} is in channel ${channelId}: ${isInChannel ? GREEN : RED}${isInChannel}${RESET}`);
        })
    });

    socket.on('disconnect', () => {
        if (socket.userId) {
            userSockets.delete(socket.userId);
            console.log(`User ${socket.userId} disconnected`);
        }
    });
});

server.listen(PORT, () => {
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

app.get('/getchannels', (req, res) => {
    const { userId, keyValue } = req.query;
    if (!userId || !keyValue) {
        return res.status(400).send("Missing userId or keyValue!");
    }

    verifyUserKey(db, keyValue, (err, row) => {
        if (err || !row) {
            return res.status(401).send("Invalid authentication!");
        }

        getUserChannels(msgdb, userId, (err, channels) => {
            if (err) {
                res.status(500).send("Error retrieving channels: " + err.message);
            } else {
                res.status(200).json(channels);
            }
        });
    });
});

app.post('/createchannel', (req, res) => {
    const {userIds, keyValue, userId} = req.body;
    if (!userIds || !keyValue || !userId) {
        return res.status(400).send("Missing required fields: userIds, keyValue, or userId!");
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).send("userIds must be a non-empty array!");
    }

    if (!userIds.includes(userId)) {
        return res.status(400).send("You must be in the channel you are creating! Debug: " + userIds + " vs " + userId);
    }

    verifyUserKey(db, keyValue, (err, row) => {
        if (err || !row) {
            return res.status(401).send("Invalid authentication!");
        }

        createChannel(msgdb, userIds, (err, channelId) => {
            if (err) {
                res.status(500).send("Error creating channel: " + err.message);
            } else {
                res.status(200).json({channelId});
            }
        })
    })
});