const { connectDB, isDbConnected, mongoose } = require('../config/database');
const User = require('./User');
const Post = require('./Post');
const Transaction = require('./Transaction');
const TikTokAccount = require('./TikTokAccount');
const Video = require('./Video');
const Card = require('./Card');
const FeedbackRating = require('./FeedbackRating');
const FailureReport = require('./FailureReport');

module.exports = {
    connectDB,
    isDbConnected,
    mongoose,
    User,
    Post,
    Transaction,
    TikTokAccount,
    Video,
    Card,
    FeedbackRating,
    FailureReport
};
