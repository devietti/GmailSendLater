// To run the tests, go to the "Publish" menu and click "Deploy as web app..."
// and then click the link for "Test web app for your latest code" and click the
// "run unit tests" button. This will run the tests and display the results as a
// fancy HTML page.

var TEST_EMAIL_SUBJECT = "GmailSendLater-test-email";

function createTestDraft() {
  var raw = 
      'Subject: '+TEST_EMAIL_SUBJECT+'\n' + 
      'To: test@test.com\n' +
      'Content-Type: multipart/alternative; boundary=1234567890123456789012345678\n' +
      'GmailSendLater test message\n' + 
      '--1234567890123456789012345678--\n';

  var draftBody = Utilities.base64Encode(raw);

  var params = {method:"post",
                contentType: "application/json",
                headers: {"Authorization": "Bearer " + ScriptApp.getOAuthToken()},
                muteHttpExceptions:true,
                payload:JSON.stringify({
                  "message": {
                    "raw": draftBody
                  }
                })
               };
  
  var resp = UrlFetchApp.fetch("https://www.googleapis.com/gmail/v1/users/me/drafts", params);
  if (resp.getResponseCode() != 200) {
    throw resp;
  }
}

function sendAtTests() {
  
  // setup for entire suite
  TESTING_MODE = true; // disables sending emails, deletion of sending_at labels
  
  // look for an existing test email
  var threads = GmailApp.search("subject:" + TEST_EMAIL_SUBJECT);
  if ( threads.length == 0 ) {
    // create a draft email for us to test
    createTestDraft();
  }
  threads = GmailApp.search("subject:" + TEST_EMAIL_SUBJECT);
  if ( threads.length == 0 ) {
    Logger.log("ERROR: didn't find test email");
    ok(false, "looking for test email");
    return;
  }
  const TEST_THREAD = threads[0]; //.getMessages()[0];
  
  // we need to add pauses to get the tests to run reliably
  function SLEEP() {
    Utilities.sleep(15*1000); // 10s also seems to work
    TEST_THREAD.refresh();
  };
  
  function getLabName(lab) { return lab.getName(); };
  
  module( "send", {
    setup: function() {},
    teardown: function() {
      TEST_THREAD.getLabels().forEach( function(lab){TEST_THREAD.removeLabel(lab);} );
      SLEEP();
    }
  });
  
  QUnit.test("at invalid time", function() {
    const invalidTime = "send at invalid time";
    TEST_THREAD.addLabel(GmailApp.createLabel(invalidTime));
    SLEEP();
    sendLater( TEST_THREAD.getMessages() );
    SLEEP();
    // original send_at label should be preserved
    var allLabels = GmailApp.getUserLabels().map(getLabName);
    ok( allLabels.some(invalidTime), "send_at label retained" );
    // error label should be added
    var labels = TEST_THREAD.getLabels().map(getLabName);
    ok( labels.some(invalidTime), "send_at label preserved on message" );
    ok( labels.some(ERROR_LABEL), "error label added to message" );
  });
  
  QUnit.test("later today", function() {
    const sendT = Date.create("2 hours from now").set({ minutes:0, seconds:0 });
    const sendL = "send at " + sendT.format("{h} {tt}");
    TEST_THREAD.addLabel(GmailApp.createLabel(sendL));
    SLEEP();
    sendLater( TEST_THREAD.getMessages() );
    SLEEP();
    // send_at label should have been deleted
    var allLabels = GmailApp.getUserLabels().map(getLabName);
    ok( allLabels.none(sendL), "send_at label deleted" );
    // sending label should be added
    var labels = TEST_THREAD.getLabels().map(getLabName);
    var draft = TEST_THREAD.getMessages()[0];
    var sendingL = SENDING + sendT.format(SENDING_FORMAT) + " GMT" + getUTCOffset_(draft);
    ok( labels.some(sendingL), "sending label: " + JSON.stringify(labels) + " should be: " + sendingL );
  });
  
  QUnit.test("earlier tomorrow", function() {
    const sendT = Date.create("22 hours from now").set({ minutes:0, seconds:0 });
    const sendL = "send at " + sendT.format("{h} {tt}");
    TEST_THREAD.addLabel(GmailApp.createLabel(sendL));
    SLEEP();
    sendLater( TEST_THREAD.getMessages() );
    SLEEP();
    // send_at label should have been deleted
    var allLabels = GmailApp.getUserLabels().map(getLabName);
    ok( allLabels.none(sendL), "send_at label deleted" );
    // sending label should be added
    var labels = TEST_THREAD.getLabels().map(getLabName);
    var draft = TEST_THREAD.getMessages()[0];
    var sendingL = SENDING + sendT.format(SENDING_FORMAT) + " GMT" + getUTCOffset_(draft);
    ok( labels.some(sendingL), "sending label: " + JSON.stringify(labels) + " should be: " + sendingL );
  });
  
  QUnit.test("right now ", function() {
    const sendT = Date.create("2 minutes ago").set({ seconds:0 });
    const sendL = "send at " + sendT.format("{h}:{mm} {tt}");
    TEST_THREAD.addLabel(GmailApp.createLabel(sendL));
    SLEEP();
    sendLater( TEST_THREAD.getMessages() );
    SLEEP();
    // send_at label should have been deleted
    var allLabels = GmailApp.getUserLabels().map(getLabName);
    ok( allLabels.none(sendL), "send_at label deleted" );
    // sending label should be added
    var labels = TEST_THREAD.getLabels().map(getLabName);
    var draft = TEST_THREAD.getMessages()[0];
    var sendingL = SENDING + sendT.format(SENDING_FORMAT) + " GMT" + getUTCOffset_(draft);
    ok( labels.some(sendingL), "sending label: " + JSON.stringify(labels) + " should be: " + sendingL );
  });
  
  QUnit.test("later today, case sensitive", function() {
    const sendT = Date.create("2 hours from now").set({ minutes:0, seconds:0 });
    const sendL = "Send At " + sendT.format("{h} {tt}");
    TEST_THREAD.addLabel(GmailApp.createLabel(sendL));
    SLEEP();
    sendLater( TEST_THREAD.getMessages() );
    SLEEP();
    // send_at label should have been deleted
    var allLabels = GmailApp.getUserLabels().map(getLabName);
    ok( allLabels.none(sendL), "send_at label deleted" );
    // sending label should be added
    var labels = TEST_THREAD.getLabels().map(getLabName);
    var draft = TEST_THREAD.getMessages()[0];
    var sendingL = SENDING + sendT.format(SENDING_FORMAT) + " GMT" + getUTCOffset_(draft);
    ok( labels.some(sendingL), "sending label: " + JSON.stringify(labels) + " should be: " + sendingL );
  });
  
};