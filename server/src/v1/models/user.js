const mongoose = require('mongoose')
const { schemaOptions } = require('./modelOptions')

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    index: true // Explicitly create an index for better query performance
  },
  password: {
    type: String,
    required: true,
    select: false
  }
}, schemaOptions)

// Create a compound index for username to improve findOne performance
userSchema.index({ username: 1 });

module.exports = mongoose.model('User', userSchema)