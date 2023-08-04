/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const config = require('./config.json');
const Event = require('./mongodb');
const mongoose = require('mongoose');

// create LINE SDK client
const client = new line.Client(config);

const app = express();

// แทนที่ 'your_mongodb_url' ด้วย URL การเชื่อมต่อ MongoDB จริงของคุณ
mongoose.connect('mongodb+srv://Sharainwy:Mindbnk48@shar.xu2urv6.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// สร้างอ็อบเจกต์การเชื่อมต่อ
const db = mongoose.connection;

// ตรวจสอบว่าการเชื่อมต่อสำเร็จหรือไม่
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connect MongoDB Successfully');
});

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

app.get('/users', async(req, res) => {
  const id = parseInt(req.params.id);
  const client = new MongoClient(uri);
  await client.connect();
  const users = await client.db('mydb').collection('users').find({}).toArray();
  await client.close();
  res.status(200).send(users);
});

// PUT route for updating event data
app.put('/events/:userId', async (req, res) => {
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

app.get('/users', async (req, res) => {
  try {
    // ดึงข้อมูลผู้ใช้ทั้งหมดจากฐานข้อมูล
    const users = await Event.find({});

    // ส่งข้อมูลกลับไปให้กับผู้ใช้
    res.status(200).json({
      status: 'ok',
      users: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching users.',
    });
  }
});

app.get('/users/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = await Event.findOne({ 'source.userId': userId });
    if (user) {
      res.status(200).json({
        status: 'ok',
        user: user,
      });
    } else {
      res.status(404).json({
        status: 'not found',
        user: null,
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

  //     // Get user profile and store it in eventData
  //     eventData.profile = await getProfile(event.source.userId);
  //     // Find and update the existing document with upsert option
  //     // await Event.findOneAndUpdate(
  //     //   { 'source.userId': event.source.userId },
  //     //   eventData,
  //     //   { upsert: true }
  //     // );
  //     const newEvent = new Event(eventData);
  //     await newEvent.save();
  //     console.log('Sent Data to MongoDB:', eventData);
  //   } catch (error) {
  //     console.error('Error Send to MongoDB:', error);
  //   }
  // }
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

      // Save the beacon event data to MongoDB
      const newEvent = new Event(eventData);
      await newEvent.save();

      console.log('Saved Beacon Event to MongoDB:', eventData);
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

const port = config.port;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
