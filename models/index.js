const { connectDB, isDbConnected, mongoose } = require('../config/database');
const User = require('./User');
const Post = require('./Post');
const Transaction = require('./Transaction');
const TikTokAccount = require('./TikTokAccount');
const Video = require('./Video');

module.exports = {
    connectDB,
    isDbConnected,
    mongoose,
    User,
    Post,
    Transaction,
    TikTokAccount,
    Video
};
