/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const config = require('./config.json');
const Event = require('./mongodb');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const client = new line.Client(config);
const { MongoClient } = require('mongodb');
const app = express();
var cors = require('cors');
const server = http.createServer(app);
// const io = socketIo(server);
const io = socketIo(server, {
  cors: {
    origin: '*',
  },
});

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

// webhook callback
app.post('/webhook', line.middleware(config), (req, res) => {
  // req.body.events should be an array of events
  if (!Array.isArray(req.body.events)) {
    return res.status(500).end();
  }
  // handle events separately
  Promise.all(req.body.events.map(event => {
    // console.log('event', event); // show event all
    // check verify webhook event
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
//
app.get('/', (req, res) => {
  try {
    // สร้างเส้นทางสำหรับไฟล์ index.html
    const indexPath = path.join(__dirname, 'index.html');
    // app.use(express.static(path.join(__dirname, '/html')));
    // ส่งไฟล์ index.html กลับไปแสดงผลในเว็บเบราว์เซอร์
    res.sendFile(indexPath);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
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

    // Get user profile and store it in eventData
    eventData.profile = await getProfile(userId);

    // Find and update the existing document with upsert option
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
// https://carmine-hatchling-tutu.cyclic.app/users/

// app.get('/latest', cors(), async (req, res) => {
//   try {
//     const latestEvent = await Event.findOne({}).sort({ timestamp: -1 }).exec();
//     if (latestEvent) {
//       res.status(200).json(latestEvent);
//     } else {
//       res.status(404).json({ message: 'No events found in the database.' });
//     }
//   } catch (error) {
//     console.error('Error fetching latest event:', error);
//     res.status(500).json({ message: 'An error occurred while fetching the latest event.' });
//   }
// });
app.get('/latest', cors(), async (req, res) => {
  const timeout = 5000; // Timeout in milliseconds (e.g., 1 minute)
  const latestEventData = await Event.findOne({}).sort({ timestamp: -1 }).exec();
  // Function to send the latest event data when available
  const sendLatestEvent = () => {
    if (latestEventData.timestamp) {
      res.status(200).json(latestEventData);
    } else {
      // No new data yet, respond with a placeholder or empty response
      res.status(204).end();
    }
  };

  // If new data is available, send it immediately
  if (latestEventData.timestamp) {
    sendLatestEvent();
  } else {
    // Set up a timeout to send a response even if no new data is available
    const timeoutId = setTimeout(() => {
      sendLatestEvent();
    }, timeout);

    // You might also want to listen for events that trigger updates to latestEventData
    // For example, whenever a new event is saved to the database

    // In a real implementation, you would handle cleanup when the client disconnects
    res.connection.on('close', () => {
      clearTimeout(timeoutId);
    });
  }
});

app.put('/putlast', cors(), async (req, res) => {
  try {
    const latestEvent = await Event.findOne({}).sort({ timestamp: -1 }).exec();

    if (latestEvent) {
      res.status(200).json(latestEvent);
    } else {
      res.status(204).json({ message: 'No events found in the database.' });
    }
  } catch (error) {
    console.error('Error fetching latest event:', error);
    res.status(500).json({ message: 'An error occurred while fetching the latest event.' });
  }
});

app.get('/users', cors(), async (req, res) => {
// const userId = req.params.userId;
  try {
    const users = await Event.find({});
    if (users) {
      res.status(200).json({
        status: 'ok',
        users: users,
      });
    } else {
      res.status(404).json({
        status: 'not found',
        users: null,
      });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching the user.',
    });
  }
});

app.delete('/users/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    // ลบข้อมูลผู้ใช้ที่มี userId ที่ตรงกัน
    const result = await Event.deleteOne({ 'profile.userId': userId });

    if (result.deletedCount > 0) {
      res.status(200).json({
        status: 'ok',
        message: `User with userId ${userId} has been deleted.`,
      });
    } else {
      res.status(404).json({
        status: 'not found',
        message: `User with userId ${userId} not found.`,
      });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while deleting the user.',
    });
  }
});

// Handle new beacon events

// simple reply function
const replyText = (token, texts) => {
  texts = Array.isArray(texts) ? texts : [texts];
  return client.replyMessage(
    token,
    texts.map((text) => ({ type: 'text', text }))
  );
};

async function getProfile(userId) {
  try {
    const profile = await client.getProfile(userId);
    return profile;
  } catch (error) {
    console.error('Error getting profile:', error);
    return null;
  }
}

// callback function to handle a single event
async function handleEvent(event) {
//   try {
//     const eventData = {
//       type: event.type,
//       message: {},
//       source: {
//         userId: event.source.userId,
//       },
//       profile: null,
//     };

  try {
    if (event.type === 'beacon') {
      const eventData = {
        type: event.type,
        beaconType: event.beacon.type,
        userId: event.source.userId,
        timestamp: event.timestamp,
      };

      // Get user profile and store it in eventData
      eventData.profile = await getProfile(event.source.userId);

      //     await Event.findOneAndUpdate(
      //       { 'source.userId': event.source.userId },
      //       eventData,
      //       { upsert: true }
      //     );
      // // Save the beacon event data to MongoDB
      const existingEvent = await Event.findOne({ 'profile.userId': eventData.userId });
      if (existingEvent) {
        await Event.deleteMany({ 'profile.userId': eventData.userId });
      }
      const newEvent = new Event(eventData);
      await newEvent.save();

      console.log('Saved Beacon Event to MongoDB:', eventData);
      io.emit('profiledata', {
        userId: existingEvent.profile.userId,
        displayName: existingEvent.profile.displayName,
        pictureUrl: existingEvent.profile.pictureUrl,
        statusMessage: existingEvent.profile.statusMessage,
      });
    } else if (event.type === 'message') {
      // // Process the incoming message event
      // const userProfile = await getProfile(event.source.userId);
      // const displayName = userProfile ? userProfile.displayName : 'Unknown';
      // const pictureUrl = userProfile ? userProfile.pictureUrl : '';

      // // Emit the event to the connected Socket.io clients
      // io.emit('new_message', {
      //   userId: event.source.userId,
      //   displayName: displayName,
      //   pictureUrl: pictureUrl,
      //   message: event.message.text,
      //   messageType: event.message.type,
      // });

      // ค้นหาข้อมูลผู้ใช้ใน MongoDB ด้วย userId
      const existingEvent = await Event.findOne({ 'profile.userId': event.source.userId });

      if (existingEvent) {
        // console.log('Found User Data in MongoDB:', existingEvent);

        // Emit the user data to connected clients
        io.emit('profiledata', {
          userId: existingEvent.profile.userId,
          displayName: existingEvent.profile.displayName,
          pictureUrl: existingEvent.profile.pictureUrl,
          statusMessage: existingEvent.profile.statusMessage,
        });
      } else {
        console.log('User Data not found in MongoDB');
      }
    }
  } catch (error) {
    console.error('Error handling event and saving to MongoDB:', error);
  }

  switch (event.type) {
    case 'message':
      const message = event.message;
      const UserID = event.source.userId;
      const msgtype = event.type;
      const Rev = event.message.type;
      console.log('UserID : ' + UserID + '\nEvent : ' + msgtype + '  type : ' + Rev);
      switch (message.type) {
        case 'text':
          return handleText(message, event.replyToken);
        case 'image':
          return handleImage(message, event.replyToken);
        case 'video':
          return handleVideo(message, event.replyToken);
        case 'audio':
          return handleAudio(message, event.replyToken);
        case 'location':
          return handleLocation(message, event.replyToken);
        case 'sticker':
          return handleSticker(message, event.replyToken);
        default:
          throw new Error(`Unknown message: ${JSON.stringify(message)}`);
      }

    case 'follow':
      return replyText(event.replyToken, 'Got followed event');

    case 'unfollow':
      return console.log(`Unfollowed this bot: ${JSON.stringify(event)}`);

    case 'join':
      return replyText(event.replyToken, `Joined ${event.source.type}`);

    case 'leave':
      return console.log(`Left: ${JSON.stringify(event)}`);

    case 'postback':
      let data = event.postback.data;
      return replyText(event.replyToken, `Got postback: ${data}`);

    case 'beacon':
      const beacontype = event.type;
      const beaconUserId = event.source.userId;
      console.log('UserID : ' + beaconUserId + '\nEvent : ' + beacontype + '  type : ' + event.beacon.type);

      return replyText(event.replyToken, 'Hello\nBeacon Status : ' + beacontype);

    default:
      throw new Error(`Unknown event: ${JSON.stringify(event)}`);
  }
}

function handleText(message, replyToken) {
  return replyText(replyToken, message.text);
}

function handleImage(message, replyToken) {
  return replyText(replyToken, 'Got Image');
}

function handleVideo(message, replyToken) {
  return replyText(replyToken, 'Got Video');
}

function handleAudio(message, replyToken) {
  return replyText(replyToken, 'Got Audio');
}

function handleLocation(message, replyToken) {
  return replyText(replyToken, 'Got Location');
}

function handleSticker(message, replyToken) {
  return replyText(replyToken, 'Got Sticker');
}

io.on('connection', socket => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const port = config.port;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});

server.listen(3001, () => {
  console.log('Server is listening on port 3001');
});
