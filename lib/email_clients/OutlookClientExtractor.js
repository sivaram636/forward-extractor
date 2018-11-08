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
 * OutlookClientExtractor.js
 *
 */

var EmailClientExtractorBase = require('./EmailClientExtractorBase');
var cheerio = require("cheerio");
var errors = require("../Errors");
var strptime = require('micro-strptime').strptime;
var render = require("cheerio/lib/render");
var AppleClient = require("./AppleClientExtractor");
var namedRegex = require('named-regexp').named;

function OutlookClientExtractor ()
{
    this.name = "outlook";
    this.dateFormats = ["%B %d, %Y at %H:%M:%S %p", "%B %d, %Y at %H:%M:%S %p %Z"];
    this.dateRegexes = [/Date:\s*(:<date>.*)$/m];
    this.senderRegexes = [/From:\s*(:<name>.*)(:<from>.*)>$/m];
    this.destinationRegexes = [/To:\s*(:<to>.*)>$/m];
    this.bodyRegexes = [/Subject:.*$(:<body>.*)/m];
    this.appleClient = new AppleClient();

    EmailClientExtractorBase.call(this);
}


OutlookClientExtractor.prototype.extractFromHTML = function (htmlstring)
{
    $ = cheerio.load(htmlstring);
    var blockquotes;
    if ($('body blockquote').length >= $('blockquote').length)
    {
        blockquotes = $('body blockquote');
    }
    else
    {
        blockquotes = $('blockquote');
    }

    if (!blockquotes || blockquotes.length == 0)
    {
        blockquotes = $('blockquote');
    }

    var sender, senderName, body = "", datestring, date, result;
    if (blockquotes.length > 1)
    {
        sender = $($(blockquotes[0]).find('a')[0]).text();
        var j = 1;
        while(sender.indexOf('@') == -1 && j < $(blockquotes[0]).find('a').length)
        {
            sender = $($(blockquotes[0]).find('a')[j++]).text();
        }

        var bodyQuoteIndex = this.getBodyQuoteIndex(blockquotes);

        for (; bodyQuoteIndex < blockquotes.length; bodyQuoteIndex++)
        {
            body += $(blockquotes[bodyQuoteIndex]).html().trim();
        }

        //dateString = $($(blockquotes[0]).find('b')[1].next).text().trim();
        var blockquote_children = $('blockquote').children();
        //var date_string = blockquote_children[0].children[8].data.toString().trim();
        var blockquote_string = blockquote_children.text();
        //date = this.extractDateFromText(date_string);
        // date format: Date: April 17, 2014 at 12:50:56 PM EDTTo
        var dateRegex = /^.*Date:\s(\w+)\s(\d+),\s(\d+)\sat\s(\d+):(\d+):(\d+)\s(\w+)\s*.*$/m;
        var dateMatch = namedRegex(dateRegex);
        var matches = dateMatch.exec(blockquote_string);
        if (matches)
        {
            var am_pm = matches[7];
            var rawHour = parseInt(matches[4]);
            var hours_to_add = 0;
            if (am_pm === "PM" && rawHour < 12)
            {
                hours_to_add = 12;
            }
            var hour = parseInt(hours_to_add) + parseInt(matches[4]);
            var dateString = matches[1] + " " + matches[2] + ", " + matches[3] + " " + hour + ":" + matches[5] + ":" + matches[6];
            date = strptime(dateString, "%B %d, %Y %H:%M:%S");
        }
        if (date == null)
        {
            // TODO: Need to have a real way of handling emails that have no send-date, which can occur
            // TODO: sometimes on outlook emails
            //throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
        }

        senderName = null;
        var child = blockquote_children[0].children[1];
        if (child && child.data)
        {
            if (child.data.length > 0)
            {
                senderName = child.data;
            }
        }

        // Might be only in tests... names are surrounded by quotes so I will use to verify and remove.
        if (senderName)
        {
            var firstQuoteIndex = senderName.indexOf("\"");
            var lastQuoteIndex = senderName.lastIndexOf("\"");
            if (firstQuoteIndex != -1 && lastQuoteIndex != -1 && firstQuoteIndex !== lastQuoteIndex)
            {
                senderName = senderName.substring(firstQuoteIndex + 1, lastQuoteIndex);
            }
            else
            {
                senderName = null;
            }

        }

        // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
        if (senderName === sender)
        {
            senderName = null;
        }

        result = {html: body, date: date, sender: sender, senderName: senderName};
        return result;
    }
    else if (blockquotes.length == 1)
    {
        sender = $($(blockquotes[0]).find('a')[0]).text();
        var bodydivs = $(blockquotes[0]).find('div');
        if ($(bodydivs[bodydivs.length - 1]).text().trim() == "")
        {
            body = $(blockquotes[0]).html();
        }
        else
        {
            body = render(bodydivs[bodydivs.length - 1]).trim();
        }
        dateString = $($(bodydivs[2]).find('span')[1]).text().trim();
        date = this.extractDateFromText(dateString);
        senderName = this.extractSenderNameFromText();
        result = {html: body, date: date, sender: sender, senderName: senderName};
        return result;

    }
    else
    {
        throw new errors.ExtractionError("Parsing of forward failed. No blockquote tag was found.");
    }
};

OutlookClientExtractor.prototype.getBodyQuoteIndex = function (blockquotes)
{
    var isNestedBlockquote = null;
    var blockquoteIndex = 0;
    for (var i = 0; i < blockquotes.length; i++) {
        isNestedBlockquote = this.isNestedBlockquote(blockquotes[i]);
        if (!isNestedBlockquote)
        {
            blockquoteIndex++;
        }
        // we are looking for the second blockquote which does not contain a nested blockquote
        if (blockquoteIndex == 2)
        {
            return i;
        }
    }
    return blockquoteIndex;
};

OutlookClientExtractor.prototype.isNestedBlockquote = function (blockquote)
{
    var isNestedBlockquote = false;
    var children = blockquote.children;
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.type === "tag" && child.name === "blockquote")
        {
            return true;
        }
        else if (child.type === "tag" && child.name === "div" && child.children && child.children.length > 0)
        {
            var grandchildren = child.children;
            for (var j = 0; j < grandchildren.length; j++) {
                var grandchild = grandchildren[j];
                if (grandchild.type === "tag" && grandchild.name === "blockquote")
                {
                    return true;
                }
            }
        }
    }
    return isNestedBlockquote;
};


OutlookClientExtractor.prototype.findForwardInHTML = function (htmlstring)
{
    // Since outlook and apple mail client both have similar syntax for the forward
    // we need to check if outlook matches the same index as apple (the apple check
    // will not match an outlook forward, but an outlook forward will match apple)
    var appleForwardIndex = this.appleClient.findForwardInHTML(htmlstring);
    var appleForwardIndexFound = appleForwardIndex != -1 ? true : false;

    // remove line breaks
    var forwarded_header_pos = htmlstring.indexOf('Begin forwarded message:');
    var blockquote_pos = htmlstring.indexOf('<blockquote type="cite">');
    var outlookForwardIndex = Math.min(forwarded_header_pos, blockquote_pos);

    var outlookForwardIndexFound = forwarded_header_pos != -1 && blockquote_pos != -1 ? true : false;

    if (appleForwardIndexFound && outlookForwardIndexFound)
    {
        // if they are the same, then it is an apple forward, not an outlook one
        if (appleForwardIndex === forwarded_header_pos)
        {
            return -1;
        }
        else
        {
            // otherwise return the outlook forward position
            return outlookForwardIndex;
        }
    }
    else if (outlookForwardIndexFound)
    {
        return outlookForwardIndex;
    }

    return -1;
};


OutlookClientExtractor.prototype.findForwardInRawText = function (textstring)
{
    if (textstring === undefined || textstring === null) {
        return -1;
    }
    var forwarded_header_pos = textstring.indexOf('------------------------------');
    if(textstring.charAt(forwarded_header_pos - 1) === '>' || forwarded_header_pos == 0) {
        forwarded_header_pos = -1;
    }
    return forwarded_header_pos;
};

OutlookClientExtractor.prototype.__proto__ = EmailClientExtractorBase.prototype;

module.exports = OutlookClientExtractor;
