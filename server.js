/**
 * Copyright 2018 Artificial Solutions. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *    http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */ 

const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const request = require('request-promise-native');
const TIE = require('@artificialsolutions/tie-api-client');

const {
  FB_PAGE_ACCESS_TOKEN,
  FB_VERIFY_TOKEN,
  REDISCLOUD_URL,
  TENEO_ENGINE_URL,
} = process.env;
const port = process.env.PORT || 4649;
const teneoApi = TIE.init(TENEO_ENGINE_URL);

/* *
 * SERVER SETUP
 * */

const app = express();

app.use('/webhook', facebookWebhook(SessionHandler()));

app.listen(port, () => {
  console.log(`Teneo Facebook Bot running on port ${port}`);
  console.log(`Talking to Teneo Engine @ ${TENEO_ENGINE_URL}`);
});

/* *
 * SESSION HANDLER
 * */

function SessionHandler() {
  const redisClient = redis.createClient({ prefix: 'fb', url: REDISCLOUD_URL});

  return {
    getSession: (userId) => new Promise((resolve, reject) => {
      redisClient.get(userId, (err, res) => {
        if (err) reject(err);
        resolve(res);
      });
    }),
    setSession: (userId, sessionId) => new Promise((resolve, reject) => {
      redisClient.set(userId, sessionId, (err1) => {
        if (err1) reject(err1);

        const oneDay = 24 * 60 * 60;
        redisClient.expire(userId, oneDay, (err2) => {
          if (err2) reject(err2);
          resolve();
        });
      });
    })
  };
}

/* *
 * FACEBOOK WEBHOOK ROUTER
 * */

function facebookWebhook(sessionHandler) {
  const router = express.Router();

  router.use(bodyParser.json());
  router.get('/', verifyEndpoint);
  router.post('/', handleFacebookMessage(sessionHandler));

  return router;
}

function verifyEndpoint(req, res) {
  if (req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.send('Error, wrong validation token');
  }
}

function handleFacebookMessage(sessionHandler) {
  return (req, res) => {
    res.sendStatus(200);

    req.body.entry.forEach(({ messaging }) => {
      messaging.forEach(async ({ message, sender }) => {
        try {
          console.log(`Got message '${message.text}' from sender ${sender.id}`);

          const sessionId = await sessionHandler.getSession(sender.id);
          const teneoResponse = await teneoApi.sendInput(sessionId, {
            text: message.text
          });

          console.log(`Got Teneo Engine response '${teneoResponse.output.text}' for session ${teneoResponse.sessionId}`);

          await sessionHandler.setSession(sender.id, teneoResponse.sessionId);
          const facebookMessage = createFacebookMessage(sender.id, teneoResponse.output.text);

          await sendFacebookMessage(facebookMessage);
        } catch (error) {
          console.error(`Failed when sending input to Teneo Engine @ ${TENEO_ENGINE_URL}`, error);
        }
      });
    });
  };
}

function createFacebookMessage(recipientId, text) {
  return {
    message: { text },
    recipient: { id: recipientId }
  };
}

async function sendFacebookMessage(messageData) {
  try {
    const response = await request({
      uri: 'https://graph.facebook.com/v2.6/me/messages',
      qs: { access_token: FB_PAGE_ACCESS_TOKEN },
      method: 'POST',
      json: messageData,
      resolveWithFullResponse: true
    });

    if (response.statusCode !== 200) {
      throw new Error(`Got status code ${response.statusCode} when sending response.`);
    }

    console.log('Sent response to Facebook', messageData);
  } catch (error) {
    console.error('Got error while sending message to Facebook', error);
  }
}
