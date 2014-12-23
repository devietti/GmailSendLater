// DOCS
// https://developers.google.com/apps-script/reference/gmail/
// https://developers.google.com/gmail/api/v1/reference/users/drafts
// http://stackoverflow.com/questions/17660601/create-draft-mail-using-google-apps-script
// http://sugarjs.com/api/

// GLOBAL CONSTANTS
var SEND_AT = "send at ";
var SENDING = "GmailSendLater/sending_at ";
var SENDING_FORMAT = "{Weekday} {Month} {dd}, {yyyy} {hh}:{mm}:{ss} {tt}";
var ERROR_LABEL = "GmailSendLater/error";
var SEND_LATER_TRIGGER = "sendLaterTrigger";
var TRIGGER_PERIOD_MINUTES = 15;
var LOG_KEY = "log";
var LOG_SIZE = 3000; // max property size is 9kB = 4k characters
var TESTING_MODE = false;

function onInstall() {
  // create ERROR_LABEL label if it doesn't exist
  if ( null == GmailApp.getUserLabelByName(ERROR_LABEL) ) {
    GmailApp.createLabel(ERROR_LABEL);
    Logger.log("created error label");
  }

  // add trigger if it doesn't exist
  var triggers = ScriptApp.getProjectTriggers();
  var hasTrigger = triggers.some( function(t){return t.getHandlerFunction() == SEND_LATER_TRIGGER} );
  if ( !hasTrigger ) {
    var trig = ScriptApp.newTrigger(SEND_LATER_TRIGGER)
    .timeBased()
    .everyMinutes(TRIGGER_PERIOD_MINUTES)
    .create();
    Logger.log("installed trigger");
  }
  
  persistLog_(Logger.getLog());
  
  // so that we are granted permissions for ScriptApp, used by code in install.html
  var _ = ScriptApp.getService().getUrl();
};

function doGet(e) {
  switch (e.parameter.action) {
    case "log":
      var logs = PropertiesService.getUserProperties().getProperty(LOG_KEY);
      return ContentService.createTextOutput(logs);
    case "unittest":
      QUnit.helpers( this );
      console = Logger;
      QUnit.load( sendAtTests );
      return QUnit.getHtml();
    case "run":
      sendLaterTrigger();
      // NB: fallthrough to go back to the install page
    default:
      var myURL = ScriptApp.getService().getUrl();
      var template = HtmlService.createTemplateFromFile('install');
      template.TRIGGER_PERIOD_MINUTES = TRIGGER_PERIOD_MINUTES;
      return template.evaluate();
  }
}

/** log the message to a script property */
function persistLog_(msg) {
  if ( msg == "" ) { return; }
  
  var scriptProps = PropertiesService.getUserProperties();
  var oldlog = scriptProps.getProperty(LOG_KEY);
  if ( oldlog == null ) {
    oldlog = "";
  }
  
  var newlog = (msg + oldlog).first(LOG_SIZE);
  scriptProps.setProperty(LOG_KEY, newlog);
};

function clearLog() {
  PropertiesService.getUserProperties().deleteProperty(LOG_KEY);
};

/** Used to easily disable the send later trigger during testing */
function nopTrigger() {}

function sendLaterTrigger() {
  Logger.log("Setting user locale to '" + Session.getActiveUserLocale() + "'");
  try {
    Date.setLocale(Session.getActiveUserLocale());    
  } catch (e) {
    Logger.log("WARNING: could not set locale to '" + Session.getActiveUserLocale() + "'");
  }
  
  try {
    sendLater( GmailApp.getDraftMessages() );
  } catch(ex) { 
    Logger.log(ex);
  }
  
  persistLog_(Logger.getLog());
};

function sendLater(messages) {
    
  // CHECK FOR DRAFTS TO SEND
  
  // translate labels from "send at ..." to "sendint_at ..."
  
  function isSendAt(lab) { return lab.getName().toLowerCase().startsWith(SEND_AT); };
  function isSending(lab) { return lab.getName().startsWith(SENDING); };  
  var sendat = messages.filter( function(d){
    return d.getThread().getLabels().some(isSendAt);
  });
  sendat.forEach( function(d){
    var sendatL = d.getThread().getLabels().find(isSendAt);
    
    // If there are multiple drafts per thread, then this label was already translated due to another draft.
    if (sendatL === undefined) {
      if (d.getThread().getLabels().find(isSending) === undefined) {
        Logger.log("Couldn't find expected sending_at label for " + d.getThread().getLabels());
      }
      return;
    }
    
    var timestring = sendatL.getName().from(SEND_AT.length);
    var sendtime = Date.create( timestring );
    
    if ( !sendtime.isValid() ) { // time could not be parsed
      d.getThread().addLabel(GmailApp.getUserLabelByName(ERROR_LABEL));
      Logger.log( "ERROR: couldn't parse send at time: "+sendatL.getName().from(SEND_AT.length) );
      
    } else { // time was parsed
      Logger.log("sendtime: " + sendtime);
      // if it's 2pm, "send at 9am" means "send at 9am *tomorrow*"
      if ( sendtime.minutesAgo() > 2*TRIGGER_PERIOD_MINUTES ) {
        sendtime = Date.future( timestring );
        Logger.log("called future(), new sendtime is : " + sendtime);
      }

      // TODO: use user/script tz? via Session.getActiveUserTimeZone() or Session.getScriptTimeZone()
      // tz is of the form America/New_York which would require parsing via a dedicated tz library
      
      // use the timezone *from the draft*, not the Google datacenter's timezone
      var sending = SENDING + sendtime.format(SENDING_FORMAT) + " GMT" + getUTCOffset_(d);
      
      Logger.log("parsed [" + sendatL.getName() + "] into [" + sending + "]");
      GmailApp.createLabel(sending);
      d.getThread().addLabel( GmailApp.getUserLabelByName(sending) );
      d.getThread().removeLabel(sendatL);
    }
  });
  
  // SEND ANY DRAFTS THAT ARE READY
  
  var tosend = messages.filter( function(d){
    return d.getThread().getLabels().some(isSending);
  });
  tosend.forEach( function(d){
    var sendingL = d.getThread().getLabels().find(isSending);
    var sendtime = Date.create( sendingL.getName().from(SENDING.length) );
    
    if ( !sendtime.isValid() ) {
      Logger.log( "ERROR: couldn't parse sending time: "+sendingL.getName().from(SENDING.length) );
      d.getThread().addLabel(GmailApp.getUserLabelByName(ERROR_LABEL));
      return;
    }
    
    if ( sendtime.isBefore(/*now*/) ) {
      // send anything that should be sent before now
      
      if ( sendtime.hoursAgo() > 1 ) {
        Logger.log("WARNING: email should have been sent at " + sendtime + " but is being sent at " + Date.create().format(Date.RFC1123));
      }
      if ( !TESTING_MODE ) {
        var dt = d.getThread();
        sendDraft(d);
        
        // only remove sending label if there are no more drafts to send from this thread
        dt.refresh();
        if ( dt.getMessages().none(function(m){return m.isDraft() && m.getId() != d.getId()}) ) {
          dt.removeLabel(sendingL);
        }
      }
    }
  });
  
  // CLEANUP UNUSED LABELS
  
  var toDelete = GmailApp.getUserLabels().filter( function(lab){
    return (lab.getName().toLowerCase().startsWith(SEND_AT) || lab.getName().startsWith(SENDING)) && 
      lab.getThreads().length == 0;
  });
  toDelete.forEach( function(lab){
    Logger.log("deleting label: " + lab.getName());
    lab.deleteLabel();
  });
  
};

function getUTCOffset_(msg) {
  var m = /GMT([-+]\d\d):?(\d\d)/.exec(msg.getDate().toString());
  Logger.log( [msg.getDate().toString(), m] );
  return (m == null) ? null : m[1] + m[2];
};

function getDST_(msg) {
  var m = /[(](.{1,5})[)]$/.exec(msg.getDate().toString());
  Logger.log( [msg.getDate().toString(), m] );
  return m[1].endsWith("DT");
};

/** returns the "draft id" of the given GmailMessage draft */
function getDraftId(d) {
  var params = { method:"get",
                 headers: {"Authorization": "Bearer " + ScriptApp.getOAuthToken()},
                 muteHttpExceptions:true,
               };
  var resp = UrlFetchApp.fetch("https://www.googleapis.com/gmail/v1/users/me/drafts", params);
  if (resp.getResponseCode() != 200) {
    throw resp;
  }
  //Logger.log(resp.getContentText());
  var drafts = JSON.parse(resp.getContentText()).drafts;
  
  for (var i = 0; i < drafts.length; i++) {
    if ( drafts[i].message.id === d.getId() ) {
      Logger.log("Found message. MessageId=" + d.getId() + " DraftId=" + drafts[i].id);
      return drafts[i].id;
    }
  }
  
  throw ("No draft found with message id " + d.getId());
}

/** Sends the draft GmailMessage d */
function sendDraft(d) {
  var params = {method:"post",
                contentType: "application/json",
                headers: {"Authorization": "Bearer " + ScriptApp.getOAuthToken()},
                muteHttpExceptions:true,
                payload:JSON.stringify({ "id":getDraftId(d) })
               };

  Logger.log( "trying to send draft: " + JSON.stringify(params) );
  
  var resp = UrlFetchApp.fetch("https://www.googleapis.com/gmail/v1/users/me/drafts/send", params);
  Logger.log(resp.getContentText());
  
  if (resp.getResponseCode() != 200) {
    throw resp;
  }
}