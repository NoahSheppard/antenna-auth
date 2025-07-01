const sqlite3 = require('sqlite3').verbose();

function initdb() {
    let db = new sqlite3.Database('./db/users.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.log('Error opening database ' + err.message);
        } else {
            console.log('Connected to the users database.');
        }
    })
    return db; 
}

module.exports = {
    initdb
};