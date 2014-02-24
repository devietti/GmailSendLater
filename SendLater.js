// DOCS
// https://developers.google.com/apps-script/reference/gmail/
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
  }

  // add trigger if it doesn't exist
  var triggers = ScriptApp.getProjectTriggers();
  var hasTrigger = triggers.some( function(t){return t.getHandlerFunction() == SEND_LATER_TRIGGER} );
  if ( !hasTrigger ) {
    var trig = ScriptApp.newTrigger(SEND_LATER_TRIGGER)
    .timeBased()
    .everyMinutes(TRIGGER_PERIOD_MINUTES)
    .create();
  }
};

/** log the message to a script property */
function persistLog_(msg) {
  if ( msg == "" ) { return; }
  
  var oldlog = ScriptProperties.getProperty(LOG_KEY);
  if ( oldlog == null ) {
    oldlog = "";
  }
  
  var newlog = (JSON.stringify(msg) + oldlog).first(LOG_SIZE);
  ScriptProperties.setProperty(LOG_KEY, newlog);
};

function clearLog() {
  ScriptProperties.deleteProperty(LOG_KEY);
};

function sendLaterTrigger() {
  Logger.log("Setting user locale to '" + Session.getActiveUserLocale() + "'");
  try {
    Date.setLocale(Session.getActiveUserLocale());    
  } catch (e) {
    Logger.log("WARNING: could not set locale to '" + Session.getActiveUserLocale() + "'");
  }
  
  sendLater( GmailApp.getDraftMessages() );
};

function sendLater(messages) {
    
  // CHECK FOR DRAFTS TO SEND
  
  function isSendAt(lab) { return lab.getName().startsWith(SEND_AT); };
  var sendat = messages.filter( function(d){
    return d.getThread().getLabels().some(isSendAt);
  });
  sendat.forEach( function(d){
    var sendatL = d.getThread().getLabels().find(isSendAt);
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
  
  function isSending(lab) { return lab.getName().startsWith(SENDING); };
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
        sendDraft(d);
        d.getThread().removeLabel(sendingL);
      }
      Logger.log("sending draft " + d.getPlainBody());
    }
  });
  
  // CLEANUP UNUSED LABELS
  
  var toDelete = GmailApp.getUserLabels().filter( function(lab){
    return (lab.getName().startsWith(SEND_AT) || lab.getName().startsWith(SENDING)) && lab.getThreads().length == 0;
  });
  toDelete.forEach( function(lab){
    Logger.log("deleting label: " + lab.getName());
    lab.deleteLabel();
  });
  
  persistLog_(Logger.getLog());
  
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

function sendDraft(d) {
  // find appropriate alias from which to send
  var from = GmailApp.getAliases().find( function(alias){return d.getFrom().has(alias);} );
  
  var opts = {
    "attachments":d.getAttachments(),
    "bcc"      :d.getBcc(),
    "cc"       :d.getCc(),
    "htmlBody" :d.getBody(),
    "replyTo"  :d.getReplyTo(),
    "noReply"  :false,
    "subject"  :d.getSubject() // used by GmailThread.replay() and .forward()
  };
  if ( from != null ) {
    opts["from"] = from;
  }
  
  // send the message
  
  if ( d.getThread().getMessageCount() == 1 ) {
    // message not part of a thread
    Logger.log("sendEmail()");
    GmailApp.sendEmail(d.getTo(), d.getSubject(), d.getPlainBody(), opts);
    
  } else {
    // message is part of a thread, try to maintain threading
    
    // look for a message we can reply to: msg's from-addr == our to-addr
    var msgs = d.getThread().getMessages().filter(function(msg){
      return !msg.isDraft() && msg.getId() != d.getId() &&
        canonicalizeEmailList_(msg.getFrom()) == canonicalizeEmailList_(d.getTo());
    });
    if (msgs.length > 0) {
      // NB: reply() doesn't support changes in recipients
      Logger.log("reply()");
      msgs.last().reply(d.getPlainBody(), opts);
      
    } else {
      // we didn't find a message to reply() to, so forward() the draft
      // NB: forward() breaks threading if we *don't* change the recipients :-/
      Logger.log("forward()");
      d.forward(d.getTo(), opts);
    }
  }
  
  // discards the original draft
  d.moveToTrash();
  
};

/** Take a list of emails and return just the addresses as a sorted, comma-delimited list. */
function canonicalizeEmailList_(s) {
  var parts = s.split(",").map( function(p){
    // extract the address from addresses of the form "First Last <first@example.com>"
    var m = /<(.*)>/.exec(p);
    return (m == null) ? p : m[1] ;
  } );  
  parts.sort();
  return parts.join(",");
};