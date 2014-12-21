// To run the tests, go to the "Publish" menu and click "Deploy as web app..."
// and then click the link for "Test web app for your latest code." This will
// run the tests and display the results as a fancy HTML page.

function doGet( e ) {
  QUnit.helpers( this );
  console = Logger;
  QUnit.load( sendAtTests );
  return QUnit.getHtml();
};

function sendAtTests() {
  
  // setup for entire suite
  TESTING_MODE = true; // disables sending emails, deletion of sending_at labels
  const TEST_EMAIL_SUBJECT = "GmailSendLater-test-email";
  
  // look for an existing test email
  var threads = GmailApp.search("subject:" + TEST_EMAIL_SUBJECT);
  if ( threads.length == 0 ) {
    // send the test email to ourselves
    GmailApp.sendEmail(Session.getActiveUser().getEmail(), TEST_EMAIL_SUBJECT, "");
    Utilities.sleep(30 * 1000); // 30s
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