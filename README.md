GmailSendLater is a [Google Apps
Script](http://code.google.com/googleapps/appsscript/) that lets you send a Gmail draft at a specified time in the future. If you're writing work emails at 2am but want to preserve the illusion of work-life balance, you can use this script to sleep in and have the emails automatically sent at 9am as if they were sent by a normal human.

## Installation

You can install GmailSendLater directly by visiting the [installation page](https://script.google.com/macros/s/AKfycbxLEvLCZROFQcnFMTCtdi7g4-EzX76lnvwvpiEwva-STnEKA6Qi/exec) and granting the application the permissions it needs (see *Required Permissions*, below).

If you want to customize the code for your installation, you can perform a *Manual Installation* (see below).

## Uninstalling

Visit GmailSendLater's [installation page](https://script.google.com/macros/s/AKfycbxLEvLCZROFQcnFMTCtdi7g4-EzX76lnvwvpiEwva-STnEKA6Qi/exec) and click the **uninstall** button.

## Usage

1. Create a draft email that you would like sent.
2. To have that draft sent at 9am tomorrow, add a new label to the thread containing the draft named "send at 9am tomorrow".
3. The draft will automatically be sent at 9am tomorrow by Google's servers. You don't have to be logged into Gmail or even have your computer on.

You can use natural language to express the time at which the email should be sent. Try out different expressions at the [SugarJS Dates site](http://sugarjs.com/dates). If GmailSendLater doesn't understand the time you typed, it will add the **GmailSendLater/error** label to the thread and the draft will **not** be sent.

GmailSendLater will automatically delete these labels after the drafts have been sent, to avoid cluttering your Gmail account.

## Features & Limitations

Features:
* The time at which a draft should be sent is specified via a label, so the formatting of the draft is not affected by GmailSendLater.
* You can easily send a bunch of drafts at a specific time, by labeling them all at once.
* Threading with drafts is preserved, just as if you hit the "send" button yourself.
* GmailSendLater tries to be smart about the times you specify. If it's 8pm on Thursday and you specify that a draft should be sent at "9am", it will assume you mean 9am Friday morning.
* GmailSendLater renames each label to a more verbose time format before sending. This lets you verify that GmailSendLater understands when you want a draft to be sent. Removing this label will prevent the draft from being sent.

Known limitations:
* If there are multiple drafts per thread, they will all be sent at the same time via GmailSendLater (since labels are per-thread, not per-message).

## Required Permissions

GmailSendLater requires several permissions to run. These should not be granted lightly - this is your email account after all! Here's an explanation of why each permission is needed.

* **View and manage your mail:** used to find the drafts to send and to manipulate their labels

* **View and manage data associated with the application:** used to log the script's execution for debugging purposes

* **Allow this application to run when you are not present:** allows emails to be sent at any time, whether you are logged in or not

* **Connect to an external service:** needed to actually send the emails, which occurs via the [Gmail API](https://developers.google.com/gmail/api/v1/reference/users/drafts). Google Apps Script does not currently offer 1) a clean way to send a draft (instead, the draft must be copied and the copy sent) which results in issues with message threading, or 2) any way to discard drafts (which results in drafts remaining in the message thread after sending). Thus, making calls to the Gmail API (which counts as an external web service) is required.


## Manual Installation

You'll copy the source code for GmailSendLater into your own "Google Apps Script" project.

1. Follow the directions at https://developers.google.com/apps-script/guides/standalone to setup Google Apps Script for your account.

2. Create a new Google Apps Script using the "Blank Project" template

3. Copy and paste the source code for the .js files into equivalent .gs script files in your project. The names of the .gs files don't actually matter, though the file **install.html** must be named as such. Don't worry about **tests.js** unless you want to run the unit tests.

4. Next setup the script to run periodically in the background. From the **Run** menu, click **onInstall** to run the installation code. This will prompt you to grant (most of) the permissions that GmailSendLater needs. For an explanation of the relevant permissions, see **Required Permissions** above.

5. Next you'll enable access to the Gmail API. From the **Resources** menu, click **Advanced Google services...** and then at the bottom of the dialog box the link for the **Google Developers Console**, find the **Gmail API** entry and turn it **On**.

6. GmailSendLater is now installed. Next, send yourself a test email via the **Usage** instructions above. By default GmailSendLater sends emails every 15 minutes. To cause emails to be sent sooner, you can manually trigger sending via the **Run** menu by selecting the **sendLaterTrigger** entry.

## Shout-outs

I was inspired to write this by the [Gmail Delay Send script](https://code.google.com/p/gmail-delay-send/) which offers similar functionality with a different UI. Check it out: maybe you'll like it better!

GmailSendLater uses the excellent [SugarJS library](http://sugarjs.com) from Andrew Plummer, which makes the code a lot cleaner.

GmailSendLater uses the Google Apps Script version of [QUnit](http://qunitjs.com/) for testing.
