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
 * GmailClientExtractor.js
 *
 */

var EmailClientExtractorBase = require('./EmailClientExtractorBase');
var cheerio = require("cheerio");
var errors = require("../Errors");
var namedRegex = require('named-regexp').named;
var strptime = require('micro-strptime').strptime;
var render = require("cheerio/lib/render");

function GmailClientExtractor ()
{
    this.name = "gmail";
    this.dateFormats = [
        "%A, %B %d, %Y at %H:%M %p",
        "%Y-%m-%d %H:%M %p",
        "%B %d, %Y %H:%M %p",
        "%A, %B %d, %Y",
        "%A, %d %B %Y",
        "%Y-%m-%d %H:%M:%S %Z",
        "%Y-%m-%d %H:%M %Z",
        "%Y-%m-%d %H:%M",
        "%d %B %Y at %H:%M %p",
        "%d %B %Y at %H:%M",
        "%d %B %Y %H:%M %p",
        "%d %B %Y %H:%M",
        "%B %d, %Y, %H:%M"
    ];
    this.dateRegexes = [/Date:\s*(:<date>.*)$/m];
    this.senderRegexes = [
        /From:(:<name>[^<]*)<(:<from>[^<]*)<(:<mailto>[^>]*)>\s*>$/m,
        /From:(:<name>[^<]*)<(:<from>[^>]*)>$/m
    ];
    this.destinationRegexes = [/To:.*,\s*<(:<to>.*@.*)>$/m,
        /To:.*<(:<to>.*@.*)>$/m,
        /To:.*,\s*(:<to>.*@.*)$/m,
        /To:.*(:<to>.*@.*)$/m];
    this.bodyRegexes = [/To:.*$(?:CC:.*$)?(:<body>(?:.|\s|\n|\r|\f)*)/m];


    EmailClientExtractorBase.call(this);
}


GmailClientExtractor.prototype.extractFromHTML = function (htmlstring)
{
    // Make sure that all <br>'s also have a \n
    htmlstring = htmlstring.replace(/<\s*br\s*\/?>/g, "<br>\n");
    var $ = cheerio.load(htmlstring);
    var gmail_quote = $("div.gmail_quote");
    if(gmail_quote.length == 0)
    {
        gmail_quote = $.root()[0];
        while(gmail_quote.type != 'text' && gmail_quote.next)
        {
            gmail_quote = gmail_quote.next;
        }
    }

    if (gmail_quote.length > 0)
    {
        // result vars
        var body, date, sender, senderName, destination;

        // Decide how it needs to be parsed.
        var gmail_quote_children = gmail_quote.children();

        var gmail_quote_div = gmail_quote.find('div');

        var body_children, dateString, forwardHeaderText;

        forwardHeaderText = gmail_quote.text();

        sender = this.extractSender(gmail_quote);
        if (sender == null)
        {
            throw new errors.ExtractionError("Parsing failed. Couldn't find the sender email address.");
        }

        senderName = this.extractSenderName(gmail_quote);
        // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
        if (senderName === sender)
        {
            senderName = null;
        }

        date = this.extractDateFromText(forwardHeaderText);
        if (date == null)
        {
            throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
        }

        destination = this.extractDestinationFromText(forwardHeaderText);
        if (destination == null)
        {
            throw new errors.ExtractionError("Parsing failed. Couldn't find the destination email address.");
        }

        // Search through the tags for the To: field. everything after is considered body.
        var lastForwardHeaderTag = gmail_quote.find("a:contains('" + destination + "')");

        if (lastForwardHeaderTag.length == 0)
        {
            throw new errors.ExtractionError("Parsing failed. Couldn't find the To: tag.")
        }

        body = this.extractBody(gmail_quote);

        if (body == null)
        {
            throw new errors.ExtractionError("Parsing failed. Couldn't find the body.");
        }

        return {html: body, date: date, sender: sender, senderName: senderName};
    }
    else
    {
        throw new errors.ExtractionError("Parsing of forward failed. No div with class gmail_quote was found.");
    }
};

GmailClientExtractor.prototype.extractBody = function (gmail_quote)
{
    var body = null;
    // try method 1
    body = this.extractBody_method_1(gmail_quote);
    if (body === "")
    {
        // try method 2
        body = this.extractBody_method_2(gmail_quote);
    }
    return body;
};

GmailClientExtractor.prototype.extractBody_method_1 = function (gmail_quote)
{
    var body_clone = gmail_quote.clone();
    body_clone.empty();
    var j = 0;

    // copy the child elements from gmail_quote that are part of the body
    var startOfBodyIndex = this.getStartOfBodyIndex(gmail_quote[0].children);
    for (var i = startOfBodyIndex; i < gmail_quote[0].children.length; i++)
    {
        body_clone[0].children[j++] = gmail_quote[0].children[i];
    }
    return body_clone.html();
};

GmailClientExtractor.prototype.extractBody_method_2 = function (gmail_quote)
{
    // find the first text node that has "To:"
    var fromNodeResult = this.findToNode(gmail_quote[0].children);
    if (fromNodeResult.isMatchFound)
    {
        var fromNode = fromNodeResult.node;
        var parentNode = fromNode.parent;
        var body_clone = $(parentNode).clone();
        body_clone.empty();

        // copy all nodes starting with the first <br> after the "To:" node
        var j = 0;
        var isToNodeFound = false;
        var isBrNodeFound = false;
        var children = $(parentNode)[0].children;
        for (var i = 0; i < children.length; i++)
        {
            var child = children[i];
            if (!isToNodeFound)
            {
                if (child.type === "text" && child.data.match(/To:/g))
                {
                    isToNodeFound = true;
                }
            }
            else if (isToNodeFound && !isBrNodeFound)
            {
                if (child.type === "tag" && child.name === "br")
                {
                    isBrNodeFound = true;
                }
            }
            else if (isToNodeFound && isBrNodeFound)
            {
                body_clone[0].children[j++] = children[i];
            }

        }
        return body_clone.html();
    }
    return null;
};

GmailClientExtractor.prototype.findToNode = function (children)
{
    var isMatchFound = false;
    for (var i = 0; i < children.length; i++)
    {
        var child = children[i];
        // check for end condition
        if (child.type === "text" && child.data.match(/To:/g))
        {
            // to node found
            return {isMatchFound: true, node: child};
        }
        else if (child.children !== undefined && child.children.length > 0)
        {
            // make recursive call
            var result = this.findToNode(child.children);
            if (result.isMatchFound) {
                return result;
            }
        }
    }
    if (!isMatchFound)
    {
        return {isMatchFound: false, node: null};
    }
};

GmailClientExtractor.prototype.extractSender = function (divNode)
{
    var child = null;
    // step 1: find the first span tag
    // step 2: find the first <a> in the children of the first span
    var children = divNode[0].children;
    for (var i = 0; i < children.length; i++) {
        child = children[i];
        if (child.type === "tag" && child.name === "span")
        {
            var span_children = child.children;
            for (var j = 0; j < span_children.length; j++)
            {
                child = span_children[j];
                if (child.type === "tag" && child.name === "a")
                {
                    // sender text
                    return child.children[0].data.toString().trim();
                }
            }
        }
    }
    // if we reach here, we did not find a sender in the loop above
    // try using a text string and regex
    var sender = this.extractSenderFromText(divNode.text());
    return sender;
};

GmailClientExtractor.prototype.extractSenderName = function (divNode)
{
    var child = null;
    // sender name is only stored within a 'b tag's
    var children = divNode[0].children;
    for (var i = 0; i < children.length; i++) {
        child = children[i];
        if (child.type === "tag" && child.name === "b")
        {
            if (child.children[0])
            {
                if (child.children[0].data.length > 0)
                {
                    return child.children[0].data.toString().trim();
                }
            }
        }
    }
    // if we reach here, we did not find a sender in the loop above
    // try using a text string and regexs
    var sender = this.extractSenderNameFromText(divNode.text());
    return sender;
};

GmailClientExtractor.prototype.getStartOfBodyIndex = function (children)
{
    var child = null;
    var index = 0;
    var toFieldFound = false;
    // step 1: find the index for the "To:" field or "Cc:" field (if it exists)
    for (var i = 0; i < children.length; i++) {
        child = children[i];
        if (child.type === "text" && child.data.indexOf("To:") > -1) {
            if (!toFieldFound)
            {
                // if we haven't found the "to" field yet, then record this index
                toFieldFound = true;
                index = i;
            }
            else
            {
                // we have found the "to" field a second time which means
                // there isn't a "cc" field and there exists another forward
                break;
            }

        }
        if (child.type === "text" && child.data.indexOf("Cc:") > -1) {
            if (toFieldFound)
            {
                // we have found a "cc" field. we can stop looking
                index = i;
                break;
            }
        }
    }
    // step 2: find the first <br> tag after the "To:" or "Cc:" field is found
    for (var i = index + 1; i < children.length; i++) {
        child = children[i];
        if (child.type === "tag" && child.name === "br")
        {
            // start of body index found
            return i;
        }
    }
    // if we reach here, we did not find the proper 'start of body index' for a typical
    // gmail forward. Now try the alternate format: Grab all nodes after the first 2 div elements
    var numberOfDivsFound = 0;
    var totalNumberOfDivsToBypass = 2;
    for (var i = 0; i < children.length; i++) {
        child = children[i];
        if (child.type === "tag" && child.name === "div")
        {
            numberOfDivsFound++;
        }
        if (numberOfDivsFound === totalNumberOfDivsToBypass)
        {
            return i + 1;
        }
    }
    return 0;
};


GmailClientExtractor.prototype.findForwardInHTML = function (htmlstring)
{
    // step 1: remove line breaks
    var htmlOneString = htmlstring.replace(/\n/g, '');
    // step 2: check if we have a unique string that only an gmail mail client would have
    var index = htmlOneString.indexOf('<div class="gmail_quote">---------- Forwarded message ----------');
    if (index === -1)
    {
        // try a second valid format
        var isMatch = htmlOneString.match(/gmail_quote.*---------- Forwarded message ----------/g);
        if (isMatch)
        {
            index = htmlOneString.indexOf('<div class="gmail_quote">');
        }

    }
    return index;
};


GmailClientExtractor.prototype.findForwardInRawText = function (textstring)
{
    if (textstring === undefined || textstring === null) {
        return -1;
    }
    var forwarded_header_pos = textstring.indexOf('---------- Forwarded message ----------');
    return forwarded_header_pos;
};

GmailClientExtractor.prototype.__proto__ = EmailClientExtractorBase.prototype;

module.exports = GmailClientExtractor;
