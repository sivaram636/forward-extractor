/*
 This file is part of Unforward.

 Unforward is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 Unforward is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with Unforward.  If not, see <http://www.gnu.org/licenses/>.

 Please see https://bitbucket.org/sensibill/unforward for
 more information on this project.
 */
/*
 * Extractor.js
 *
 */

var cheerio = require("cheerio"),
  GmailClient = require("../lib/email_clients/GmailClientExtractor"),
  OutlookClient = require("../lib/email_clients/OutlookClientExtractor"),
  Outlook2010Client = require("../lib/email_clients/Outlook2010ClientExtractor"),
  HotmailClient = require("../lib/email_clients/HotmailExtractor"),
  YahooClient = require("../lib/email_clients/YahooClientExtractor"),
  AppleClient = require("../lib/email_clients/AppleClientExtractor"),
  RyersonRMailClient = require("../lib/email_clients/RyersonRMailClientExtractor"),
  LotusNotesClient = require("../lib/email_clients/LotusNotesClientExtractor"),
  GenericClient = require("../lib/email_clients/GenericClientExtractor"),
  iPhoneClient = require("../lib/email_clients/iPhoneClientExtractor"),
  errors = require("./Errors"),
  async = require("async"),
  utils = require("./utils"),
  MailParser = require("mailparser").MailParser;

function validateEmail(email) {
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

function Extractor() {
  this._clients = [
    new GmailClient(),
    new OutlookClient(),
    new Outlook2010Client(),
    new HotmailClient(),
    new YahooClient(),
    new AppleClient(),
    //            new RyersonRMailClient(),
    new LotusNotesClient(),
    new GenericClient(),
    new iPhoneClient()
  ];
  this._log = false;
}

Extractor.prototype.getClientForName = function(name) {
  for (var n = 0; n < this._clients.length; n += 1) {
    var client = this._clients[n];
    if (client.name == name) {
      return client;
    }
  }
  return null;
};

Extractor.prototype.getMatchingClient = function(
  string,
  mode,
  iphoneclientfound
) {
  var found_client = null;
  var found_forward_pos = -1;

  for (var n = 0; n < this._clients.length; n += 1) {
    var client = this._clients[n];
    var forward_pos = -1;
    if (mode == "text") {
      forward_pos = client.findForwardInRawText(string, iphoneclientfound);
    } else {
      forward_pos = client.findForwardInHTML(string);
    }

    if (forward_pos != -1) {
      if (this._log) {
        console.log(mode, "match", { factory: client.name, pos: forward_pos });
      }
      if (found_forward_pos == -1 || forward_pos < found_forward_pos) {
        found_forward_pos = forward_pos;
        found_client = client;
      }
    } else {
      if (this._log) {
        console.log(mode, "nonmatch", { factory: client.name });
      }
    }
  }
  return found_client;
};

Extractor.prototype.extractFromHTML = function(
  htmlstring,
  callback,
  debugInfo
) {
  if (!debugInfo) {
    debugInfo = {
      matchedClients: []
    };
  }

  var client = this.getMatchingClient(htmlstring, "html");
  if (client != null) {
    try {
      var extract_result = client.extractFromHTML(htmlstring);
    } catch (err) {
      if (errors.ExtractionError.prototype.isPrototypeOf(err)) {
        return callback(err, null, debugInfo);
      }

      throw err;
    }

    if (extract_result && extract_result.html) {
      debugInfo.matchedClients.push({
        name: client.name,
        body_method: client.body_method,
        sender: extract_result.sender,
        senderName: extract_result.senderName,
        date: extract_result.date
      });

      // Check to see if there is another layer of forwarding.
      return this.extractFromHTML(
        extract_result.html,
        function(err, result) {
          if (err) {
            if (
              err instanceof errors.NoForwardFound &&
              validateEmail(extract_result.sender)
            ) {
              // Replace non-breaking-space with regular space
              extract_result.html = extract_result.html.replace(/\u00A0/g, " ");
              return callback(null, extract_result, debugInfo);
            } else {
              debugInfo.error = err.toString();
              return callback(err, null, debugInfo);
            }
          } else if (result.sender && !validateEmail(result.sender)) {
            return callback(
              new errors.ExtractionError("Invalid email extracted"),
              null,
              debugInfo
            );
          } else {
            return callback(null, result, debugInfo);
          }
        },
        debugInfo
      );
    } else {
      return callback(new errors.NoForwardFound(), null, debugInfo);
    }
  } else {
    return callback(new errors.NoForwardFound(), null, debugInfo);
  }
};

Extractor.prototype.extractFromRawText = function(
  textString,
  callback,
  debugInfo
) {
  if (!debugInfo) {
    debugInfo = {
      matchedClients: []
    };
  }

  if (this._log) {
    //console.log("text layer", {length: textString.length});
  }

  // If there is a chain of iPhone unforwards the library thinks it's Apple when it's actually iPhone, so we keep track of the fact that we found one
  var iphoneclientfound = false;
  if (
    debugInfo &&
    debugInfo.matchedClients &&
    debugInfo.matchedClients.length
  ) {
    for (var n = 0; n < debugInfo.matchedClients.length; n += 1) {
      if (debugInfo.matchedClients[n].name == "iPhone") {
        iphoneclientfound = true;
      }
    }
  }

  var client = this.getMatchingClient(textString, "text", iphoneclientfound);
  if (client != null) {
    if (this._log) {
      //console.log("text using", client.name);
    }
    var extract_result = client.extractFromRawText(textString);
    if (extract_result && extract_result.text) {
      debugInfo.matchedClients.push({
        name: client.name,
        sender: extract_result.sender,
        date: extract_result.date
      });
      if (this._log) {
        //console.log(extract_result);
      }
      return callback(null, extract_result, debugInfo);
    } else {
      return callback(new errors.NoForwardFound(), null, debugInfo);
    }
  } else {
    return callback(new errors.NoForwardFound(), null, debugInfo);
  }
};

Extractor.prototype.extractFromBoth = function(textstring, htmlstring, done) {
  var self = this;
  var funcs = [
    function(callback) {
      self.extractFromHTML(htmlstring, function(err, result, debugInfo) {
        return callback(err, { result: result, debugInfo: debugInfo });
      });
    },
    function(callback) {
      self.extractFromRawText(textstring, function(err, result, debugInfo) {
        return callback(err, { result: result, debugInfo: debugInfo });
      });
    }
  ];

  var debugInfo = {};

  async.series(funcs, function(err, results) {
    /*
         if(err)
         {
         done(err);
         return;
         }
         */

    var htmlResult = null;
    var textResult = null;
    if (results[0]) {
      htmlResult = results[0].result;
      debugInfo.html = results[0].debugInfo;
    }

    if (results[1]) {
      textResult = results[1].result;
      debugInfo.text = results[1].debugInfo;
    }

    if (textResult && !htmlResult) {
      return done(null, textResult, debugInfo);
    } else if (htmlResult && !textResult) {
      return done(null, htmlResult, debugInfo);
    } else if (!htmlResult && !textResult) {
      return done(new errors.NoForwardFound(), null, debugInfo);
    } else {
      if (textResult.sender === null || textResult.sender === undefined) {
        textResult.sender = "";
      }
      if (htmlResult.sender === null || htmlResult.sender === undefined) {
        htmlResult.sender = "";
      }
      if (textResult.sender.toString() != htmlResult.sender.toString()) {
        // If we have both text and html, in the past we would just use the html.
        // But we found cases when we have both and the html is actually bad.
        // This is very arbitrary: I force to use the sender found  instead of the html when the first is at least 5 times the length of the latter.
        if (!!htmlResult.html || !!textResult.text) {
          $ = cheerio.load(htmlResult.html.trim());
          if (
            textResult.text.length >
              5 *
                $(htmlResult.html)
                  .text()
                  .trim().length &&
            textResult.sender
          ) {
            htmlResult.sender = textResult.sender;
          }
        }
      }
      if (textResult.senderName === undefined) {
        textResult.senderName = null;
      }
      if (htmlResult.senderName === undefined) {
        htmlResult.senderName = null;
      }
      if (textResult.senderName != htmlResult.senderName) {
        // Going to follow the rules applied to sender.
        if (!!htmlResult.html || !!textResult.text) {
          $ = cheerio.load(htmlResult.html.trim());
          if (
            textResult.text.length >
            5 *
              $(htmlResult.html)
                .text()
                .trim().length
          ) {
            htmlResult.senderName = textResult.senderName;
          }
        }
      }
      if (textResult.date === null || textResult.date === undefined) {
        textResult.date = "";
      }
      if (htmlResult.date === null || htmlResult.date === undefined) {
        htmlResult.date = "";
      }
      if (textResult.date.toString() != htmlResult.date.toString()) {
        //console.log("Warning! Sender from raw-text extraction (" + textResult.sender + ") did not equal the sender from the HTML extraction (" + htmlResult.sender + "). The html extraction will be used, since it is less prone to errors");
      }

      var result = {
        sender: htmlResult.sender,
        senderName: htmlResult.senderName,
        date: htmlResult.date,
        text: textResult.text,
        html: htmlResult.html
      };
      if (!result.sender && textResult.sender) {
        result.sender = textResult.sender;
        result.senderName = textResult.senderName;
      }
      //Get Oldest sender between text and html
      if (
        new Date(htmlResult.date) > new Date(textResult.date) &&
        textResult.sender
      ) {
        result.date = textResult.date;
        result.sender = textResult.sender;
        result.senderName = textResult.senderName;
      }

      return done(null, result, debugInfo);
    }
  });
};

Extractor.prototype.extractFromMIME = function(mimestring, callback) {
  var self = this;
  var options = { normalizeWhitespace: false, unescapeSMTP: true };
  var mailparser = new MailParser(options);

  mailparser.on("end", function(mail) {
    if (!mail.html) {
      return self.extractFromRawText(mail.text, callback);
    } else if (!mail.text) {
      return self.extractFromHTML(mail.html, callback);
    } else {
      return self.extractFromBoth(mail.text, mail.html, callback);
    }
  });

  mailparser.write(mimestring);
  mailparser.end();
};

module.exports = Extractor;
