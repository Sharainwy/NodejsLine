const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  type: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  message: {
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'location', 'sticker', 'beacon'], // Add 'beacon' type here
    },
    text: String },
  // Add other properties based on the type of message if necessary
  beacon: { // Add 'beacon' property inside 'message' field
    type: {
      type: String,
      enum: ['enter', 'leave', 'banner'], // Add beacon event types if needed
    },
    // Add other properties specific to beacon messages if needed
  },

  source: {
    userId: {
      type: String,
    },
  },
  profile: {
    displayName: String,
    userId: String,
    pictureUrl: String,
    statusMessage: String,
    language: String,
    // Add other properties from the user's profile that you want to store
  },
});

// eslint-disable-next-line no-unused-vars

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
