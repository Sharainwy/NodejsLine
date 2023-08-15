/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const config = require('./config.json');
const Event = require('./mongodb');
const mongoose = require('mongoose');

// Create LINE SDK client
const client = new line.Client(config);
const app = express();
var cors = require('cors');

mongoose.connect('mongodb+srv://Sharainwy:Mindbnk48@shar.xu2urv6.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connect MongoDB Successfully');
});

app.use(cors({
  origin: '*',
}));

// Webhook callback
app.post('/webhook', line.middleware(config), (req, res) => {
  // req.body.events should be an array of events
  if (!Array.isArray(req.body.events)) {
    return res.status(500).end();
  }
  // Handle events separately
  Promise.all(req.body.events.map(event => {
    if (event.replyToken === '00000000000000000000000000000000' ||
      event.replyToken === 'ffffffffffffffffffffffffffffffff') {
      return;
    }
    return handleEvent(event);
  }))
    .then(() => res.end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// Define event emitter
const { EventEmitter } = require('events');
const eventEmitter = new EventEmitter();

// Route for SSE
app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const client = res;
  sseClients.push(client);

  client.on('close', () => {
    const index = sseClients.indexOf(client);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
  });
});

// Handle new beacon events
eventEmitter.on('beacon', (eventData) => {
  sseClients.forEach((client) => {
    client.write(`data: ${JSON.stringify(eventData)}\n\n`);
  });
});

// PUT route for updating event data
app.put('/events', async (req, res) => {
  const userId = req.params.userId;
  try {
    const eventData = {
      type: req.body.type,
      message: {},
      source: {
        userId: userId,
      },
      profile: null,
    };

    eventData.profile = await getProfile(userId);

    await Event.findOneAndUpdate(
      { 'source.userId': userId },
      eventData,
      { upsert: true }
    );

    console.log('Sent Data to MongoDB:', eventData);

    res.status(200).json({
      status: 'ok',
      eventData: eventData,
    });
  } catch (error) {
    console.error('Error Send to MongoDB:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while updating the event data.',
    });
  }
});

// ... (your other code)

// Callback function to handle a single event
async function handleEvent(event) {
  try {
    if (event.type === 'beacon') {
      const eventData = {
        type: event.type,
        beaconType: event.beacon.type,
        userId: event.source.userId,
        timestamp: event.timestamp,
      };

      eventData.profile = await getProfile(event.source.userId);

      eventEmitter.emit('beacon', eventData);

      const existingEvent = await Event.findOne({ 'profile.userId': eventData.userId });
      if (existingEvent) {
        await Event.deleteMany({ 'profile.userId': eventData.userId });
      }
      const newEvent = new Event(eventData);
      await newEvent.save();

      console.log('Saved Beacon Event to MongoDB:', eventData);
    }
  } catch (error) {
    console.error('Error handling event and saving to MongoDB:', error);
  }

  // ... (your other event handling code)
}

// ... (your other handling functions)

// Server-Sent Events clients
const sseClients = [];

// Start the server
const port = config.port;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
