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

require("dotenv").config();
const localtunnel = require("localtunnel");
const express = require("express");
const bodyParser = require("body-parser");
const request = require("request-promise-native");
const TIE = require("@artificialsolutions/tie-api-client");

const { FB_PAGE_ACCESS_TOKEN, FB_VERIFY_TOKEN, TENEO_ENGINE_URL } = process.env;
const port = process.env.PORT || 4649;
const teneoApi = TIE.init(TENEO_ENGINE_URL);

/* *
 * SERVER SETUP
 * */

const app = express();

app.use("/webhook", facebookWebhook(SessionHandler()));

app.listen(port, () => {
  console.log(`Teneo Facebook Bot running on port ${port}`);
  console.log(`Talking to Teneo Engine @ ${TENEO_ENGINE_URL}`);
});

/* *
 * SESSION HANDLER
 * */

function SessionHandler() {
  // Map the Facebook user id to the teneo engine session id.
  // This code keeps the map in memory, which is ok for testing purposes
  // For production usage it is advised to make use of more resilient storage mechanisms like redis
  const sessionMap = new Map();

  return {
    getSession: userId =>
      new Promise(resolve => {
        if (sessionMap.size > 0) {
          resolve(sessionMap.get(userId));
        } else {
          resolve("");
        }
      }),
    setSession: (userId, sessionId) =>
      new Promise(resolve => {
        sessionMap.set(userId, sessionId);
        resolve();
      })
  };
}

/* *
 * FACEBOOK WEBHOOK ROUTER
 * */

function facebookWebhook(sessionHandler) {
  const router = express.Router();

  router.use(bodyParser.json());
  router.get("/", verifyEndpoint);
  router.post("/", handleFacebookMessage(sessionHandler));

  return router;
}

function verifyEndpoint(req, res) {
  if (req.query["hub.verify_token"] === FB_VERIFY_TOKEN) {
    console.log("Verify token");
    res.send(req.query["hub.challenge"]);
  } else {
    res.send("Error, wrong validation token");
  }
}

function handleFacebookMessage(sessionHandler) {
  return (req, res) => {
    res.sendStatus(200);
    // prettyJSON(req.body);
    // if (req.body.object === "page") {
    //   req.body.entry.forEach(async ({ messaging }) => {
    //     messaging.changes.forEach(async ({ change }) => {
    //       if (change.field === "feed" && change.value.item === "comment" && change.value.verb === "add") {
    //         const commentId = change.value.comment_id;
    //         const message = change.value.message;

    //         const senderName = change.value.from.name;
    //         const senderId = change.value.from.id;
    //         try {
    //           console.log(`Got message '${message}' from sender ${senderId}`);

    //           const sessionId = await sessionHandler.getSession(sender.id);
    //           const teneoResponse = await teneoApi.sendInput(sessionId, {
    //             text: message,
    //             channel: "facebook"
    //           });

    //           console.log(
    //             `Got Teneo Engine response '${teneoResponse.output.text}' for session ${teneoResponse.sessionId}`
    //           );

    //           await sessionHandler.setSession(senderId, teneoResponse.sessionId);
    //           const facebookMessage = createFacebookMessage(senderId, teneoResponse.output.text);

    //           await sendFacebookMessage(facebookMessage);

    //           // use the engine output parameter 'fbmessenger' to send messenger templates and attachments
    //           // https://developers.facebook.com/docs/messenger-platform/send-messages/templates
    //           if (teneoResponse.output.parameters.fbmessenger) {
    //             const facebookAttachment = createFacebookAttachment(
    //               sender.id,
    //               teneoResponse.output.parameters.fbmessenger
    //             );
    //             await sendFacebookMessage(facebookAttachment);
    //           }
    //         } catch (error) {
    //           console.error(`Failed when sending input to Teneo Engine @ ${TENEO_ENGINE_URL}`, error);
    //         }
    //       }
    //     });
    //   });
    // } else {
    req.body.entry.forEach(({ messaging }) => {
      messaging.forEach(async ({ message, sender }) => {
        try {
          console.log(`Got message '${message.text}' from sender ${sender.id}`);
          const seenMessage = createFacebookSeenMessage(sender.id);
          const typingMessage = createFacebookTypingMessage(sender.id);

          sendFacebookMessage(seenMessage); // don't wait around
          sendFacebookMessage(typingMessage); // don't wait around

          const sessionId = await sessionHandler.getSession(sender.id);
          const teneoResponse = await teneoApi.sendInput(sessionId, {
            text: message.text,
            channel: "facebook"
          });

          console.log(
            `Got Teneo Engine response '${teneoResponse.output.text}' for session ${teneoResponse.sessionId}`
          );
          // prettyJSON(teneoResponse);

          await sessionHandler.setSession(sender.id, teneoResponse.sessionId);

          let facebookMessage = null;
          if (teneoResponse.output.link !== "") {
            facebookMessage = createFacebookMessageWithUrlButton(
              sender.id,
              teneoResponse.output.text,
              teneoResponse.output.link
            );
          } else {
            facebookMessage = createFacebookMessage(sender.id, teneoResponse.output.text);
          }

          await sendFacebookMessage(facebookMessage);

          // use the engine output parameter 'fbmessenger' to send messenger templates and attachments
          // https://developers.facebook.com/docs/messenger-platform/send-messages/templates
          if (teneoResponse.output.parameters.extensions) {
            const extensions = JSON.parse(teneoResponse.output.parameters.extensions);

            if (extensions.attachment) {
              const facebookAttachment = createFacebookAttachment(sender.id, extensions.attachment);
              await sendFacebookMessage(facebookAttachment);
            } else {
              const facebookAttachment = createFacebookOptionsMessage(sender.id, extensions);
              await sendFacebookMessage(facebookAttachment);
            }
          } else if (teneoResponse.output.parameters.attachment) {
            let attachment = JSON.parse(teneoResponse.output.parameters.attachment);
            prettyJSON(attachment);
            const facebookAttachment = createFacebookAttachment(sender.id, attachment);
            await sendFacebookMessage(facebookAttachment);
          }
        } catch (error) {
          console.error(`Failed when sending input to Teneo Engine @ ${TENEO_ENGINE_URL}`, error);
        }
      });
    });
    // }
  };
}

function createFacebookMessageWithUrlButton(recipientId, text, url) {
  return {
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: text,
          buttons: [
            {
              type: "web_url",
              url: url,
              title: "Article"
            }
          ]
        }
      }
    },
    recipient: { id: recipientId }
  };
}

function createFacebookSeenMessage(recipientId) {
  return {
    recipient: {
      id: recipientId
    },
    sender_action: "mark_seen"
  };
}

function createFacebookTypingMessage(recipientId) {
  return {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };
}

function createFacebookMessage(recipientId, text) {
  return {
    message: { text },
    recipient: { id: recipientId }
  };
}

function createFacebookOptionsMessage(recipientId, extensions) {
  // prettyJSON(extensions);
  let optionsMessage = {
    recipient: {
      id: recipientId
    },
    messaging_type: "RESPONSE",
    message: {
      text: extensions.parameters.content.title,
      quick_replies: []
    }
  };
  extensions.parameters.content.items.forEach(item => {
    // prettyJSON(item);
    optionsMessage.message.quick_replies.push({
      content_type: "text",
      title: item.name,
      payload: item.name
    });
  });

  // prettyJSON(optionsMessage);

  return optionsMessage;
}

function createFacebookAttachment(recipientId, attachment) {
  return {
    message: { attachment: attachment },
    recipient: { id: recipientId }
  };
}

async function sendFacebookMessage(messageData) {
  try {
    const response = await request({
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: FB_PAGE_ACCESS_TOKEN },
      method: "POST",
      json: messageData,
      resolveWithFullResponse: true
    });

    if (response.statusCode !== 200) {
      throw new Error(`Got status code ${response.statusCode} when sending response.`);
    }

    console.log("Sent response to Facebook");
  } catch (error) {
    console.error("Got error while sending message to Facebook", error);
  }
}

function prettyJSON(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

(async () => {
  const tunnel = await localtunnel({ port: port, subdomain: process.env.SUBDOMAIN_PREFIX });

  // the assigned public url for your tunnel
  // i.e. https://abcdefgjhij.localtunnel.me
  console.log(`Listening on: ${tunnel.url}/webhook`);

  tunnel.on("close", () => {
    // tunnels are closed
  });
})();
