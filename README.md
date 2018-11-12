# TIE API Facebook Messenger Example

With the Facebook Messenger connector, you can make your Teneo bot available on Facebook Messenger. This guide will take you through the steps of installing the connector (we will be using Heroku to host it) and connecting it to a business page on Facebook.

You can find the source code of this connector on [Github](https://github.com/artificialsolutions/tie-api-example-facebook-messenger).

## Prerequisites
### Server that is available via https
Facebook requires that you have a server that is available via https. We will be using [Heroku](https://www.heroku.com/) as an example here. 

### Redis
Because we need to map a Facebook sender.id with a sessionId from engine, we need to store this mapping. This connector uses <mark>Redis</mark> for that. If you follow the instructions on this page, the free RedisCloud addon will be automatically installed in your Heroku app. However, even though the addon its free, you may need to provide [Billing details in your Heroku account](https://dashboard.heroku.com/account/billing) for the module to be installed.

### Teneo Engine
Your bot needs to be published and you need to know the engine url.

## Setup instructions
### Create a new Faceboook app
Login to [developers.facebook.com](https://developers.facebook.com/apps/) and create a new app. 

After you have created the app, a new page appears called 'Add a Product'. On that page find the tile that says 'Messenger' and click the 'Set Up' button.

You have now added Messenger as a product to your Facebook app. Next you need to get a page token.

### Generate a Facebook Page Token
Facebook Messenger bots need to be connected to businesses and those businesses need to be present on Facebook with a Facebook Page. For your bot to be able to respond to questions that are sent to your business Facebook page (via Facebook Messenger) you need to generate a page token. Scroll down to the section that say 'Token Generation'. You can either select an existing Facebook Page or create a new Facebook. After you have selected the page, the token will appear. Copy this token and remember it for use later.

Make sure you copy and store the page token, because this is the only time it will be visible.

### Deploy the connector to Heroku
Click the button below to create a new Heroku app that contains the connector:

[![Deploy](https://www.herokucdn.com/deploy/button.svg?classes=noborder)](https://heroku.com/deploy?template=https://github.com/artificialsolutions/tie-api-example-facebook-messenger)

1. Give the app a name (lowercase, no spaces)
2. In the 'Config Vars' section, add the following:
    * **FB_PAGE_ACCESS_TOKEN:** The page token you got from Facebook
    * **FB_VERIFY_TOKEN:** A random token of your choice. Make sure you remember it, you will need to enter it later when you finish the Facebook configuration
    * **TENEO_ENGINE_URL:** The engine url
3. Click 'Deploy app'.

After the app has been deployed, choose 'Open app'. This will open a browser window (it will say show an error page 'Cannot GET /', but you can ignore that). Copy the url of the page and remember it, you will need to enter it later when you finish the Facebook configuration.

### Setup webhook on Facebook
Next we will need to setup the webhook. Scroll to the 'Webhooks' section and click on the 'Setup Webhooks' button. A window appears in which you need to provide a 'Callback URL' and a 'Verify Token'.

* In the 'Callback URL' field paste your Heroku server url appended with <mark>/webhook/</mark>. It should look something like this: https://yourappname.herokuapp.com/webhook/
* In the 'Verify Token' field, enter the verify token you declared when your started the Heroku app.
* For Subscription Fields select: <mark>messages</mark> and <mark>messaging_postbacks</mark>
* Select the page you want your webhook for

Click 'Verify and Save'. If verification was successful, your bot is now available via Facebook Messenger.

## Test your bot
To test your bot, go to your Facebook page and add a button:
1. Click 'Add a button'
2. You will be presented by five different categories of buttons, choose the one that says 'Contact us'
3. Select 'Send message' and press next
4. Facebook will now ask you what should happen when they press the button, choose 'Messenger'

That's it! To test it, hover over the 'Send message' button and choose 'Test button'. A messenger windows appear, allowing you chat with your bot.


## Sending attachments
To send [message templates](https://developers.facebook.com/docs/messenger-platform/send-messages/templates) or [message attachments](https://developers.facebook.com/docs/messenger-platform/send-messages#sending_attachments), this connector looks for an output parameter `fbmessenger` in the engine response. The value of that parameter is assumed to contain the attachment or message template JSON as defined by Facebook.

If we look at Facebook's specification of an [image attachment](https://developers.facebook.com/docs/messenger-platform/send-messages/#url), to attach an image, the value of the `fbmessenger` output parameter would need to look like this:
```
{
    "type": "image",
    "payload": {
        "url": "https://url.to/an/image.png",
        "is_reusable": true
    }
}
```


## Running the connector locally
If you prefer to manually install this connector or want to run it locally so you can extend it, proceed as follows:
1. Download, install and run Redis by following the instructions here: [redis.io/download](https://redis.io/download).
2. Clone or download the connector from [Github](https://github.com/artificialsolutions/tie-api-example-facebook-messenger)
3. Install dependencies by running `npm install` in the folder where you cloned or unzipped the connector.
4. Make sure your connector is available via https. When running locally you can for example use ngrok: [ngrok.com](https://ngrok.com). The connector runs on port 4649 by default.
5. Start the connector with the following command (replacing the environment variables with the appropriate values):
    ```
    FB_PAGE_ACCESS_TOKEN=<your_facebook_page_access_token> FB_VERIFY_TOKEN=<your_facebook_verify_token> TENEO_ENGINE_URL=<your_engine_url> node server.js
    ```

