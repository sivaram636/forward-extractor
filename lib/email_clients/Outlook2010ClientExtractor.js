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
 * Outlook2010ClientExtractor.js
 *
 */

var EmailClientExtractorBase = require('./EmailClientExtractorBase');
var cheerio = require("cheerio");
var errors = require("../Errors");
var strptime = require('micro-strptime').strptime;
var render = require("cheerio/lib/render");

function Outlook2010ClientExtractor ()
{
    this.name = "outlook2010";
    this.dateFormats = ["%Y, %B, %d %H:%M %p", "%A, %d %B %Y %H:%M:%S %Z"];
    this.dateRegexes = [/\*?Sent:\*?\s*(:<date>.*)$/m, /\*?Date:\*?\s*(:<date>.*)$/m];
    this.senderRegexes = [/\*?From:\*?(:<name>[^<]*)<(:<from>.*)>$/m, /\*?From:\*?(:<from>.*)$/m];
    this.destinationRegexes = [/\*?To:\*?.*<(:<to>.*)>$/m, /\*?To:\*?(:<to>.*)$/m];
    this.bodyRegexes = [/\*?Subject\*?:.*$(:<body>.*)/m];
    EmailClientExtractorBase.call(this);
}


Outlook2010ClientExtractor.prototype.extractFromHTML = function (htmlstring)
{
    $ = cheerio.load(htmlstring);
    var header = $($('div hr')[0]).parent();
    if (header.find('b').length == 0)
    {
        header = $($('span:contains("From:")')[0]).parent().parent().parent().parent();
    }

    var sender, senderName, body, datestring, destination, date, result;

    var forwardHeaderText = header.text();
    sender = this.extractSenderFromText(forwardHeaderText);
    if (sender == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the sender email address.");
    }

    senderName = this.extractSenderNameFromText(forwardHeaderText);

    // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
    if (senderName === sender)
    {
        senderName = null;
    }

    date = this.extractDateFromText(forwardHeaderText);
    if (date == null)
    {
        // TODO: Need to have a real way of handling emails that have no send-date, which can occur
        // TODO: sometimes on outlook emails
//        throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
    }

    destination = this.extractDestinationFromText(forwardHeaderText);
    if (destination == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the destination email address.");
    }

    body = render(header.nextAll());

    return {sender: sender, senderName: senderName, html: body, date: date};
};


Outlook2010ClientExtractor.prototype.findForwardInHTML = function (htmlstring)
{
    var forwarded_header_pos = htmlstring.indexOf('<hr');
    var sent_match_pos = htmlstring.indexOf('Sent:');

    if (forwarded_header_pos == -1 || sent_match_pos == -1)
    {
        return -1;
    }

    return Math.max(forwarded_header_pos, sent_match_pos);
};


Outlook2010ClientExtractor.prototype.findForwardInRawText = function (htmlstring)
{
//    var forwarded_header_pos = htmlstring.indexOf('------------------------------');
    if (htmlstring === undefined || htmlstring === null) {
        return -1;
    }
    var forwarded_header_pos = htmlstring.indexOf('*From:*');
    var sent_match_pos = htmlstring.indexOf('*Sent:*');
    return Math.min(forwarded_header_pos, sent_match_pos);
};

Outlook2010ClientExtractor.prototype.__proto__ = EmailClientExtractorBase.prototype;

module.exports = Outlook2010ClientExtractor;
