const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, hashedPassword) {
    const hash = hashPassword(password);
    return hash === hashedPassword;
}

const genRanHex = size => {
    return crypto.randomBytes(size).toString('hex');
}

module.exports = {
    hashPassword, 
    verifyPassword,
    genRanHex
}