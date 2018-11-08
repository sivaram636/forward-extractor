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
 * iPhoneClientExtractor.js
 *
 */

var EmailClientExtractorBase = require('./EmailClientExtractorBase');
var cheerio = require("cheerio");
var errors = require("../Errors");
var strptime = require('micro-strptime').strptime;
var render = require("cheerio/lib/render");
var namedRegex = require('named-regexp').named;

function iPhoneClientExtractor ()
{
    this.name = "iPhone";
    this.dateFormats = [];
    this.dateRegexes = [
        /Date:\s*(:<date>.*\s(at\s)*.*)(\n|To:)/m
    ];
    this.senderRegexes = [
        /From:.*<mailto:(:<from>.*@.*)>>/m,
        /From:(:<name>[^<]*)<(:<from>.*@.*)>.*From:/m,
        /From:(:<name>[^<]*)<(:<from>.*@.*)>.*Date:/m,
        /From:(:<name>[^<]*)<(:<from>.*@.*)>.*Content:/m,
        /From:.*<mailto:(:<from>[-a-zA-Z0-9~!$%^&*_=+}{\'?]+(\.[-a-zA-Z0-9~!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.[a-z]+|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))(:[0-9]{1,5})?)>>/m,
        /From:(:<name>[^<]*)<(:<from>[-a-zA-Z0-9~!$%^&*_=+}{\'?]+(\.[-a-zA-Z0-9~!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.[a-z]+|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))(:[0-9]{1,5})?)>((\b|\n)|(From|Date|Content):)/m,
        /From:\s*(:<from>[-a-zA-Z0-9~!$%^&*_=+}{\'?]+(\.[-a-zA-Z0-9~!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.[a-z]+|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))(:[0-9]{1,5})?)/m,
        /From:\s*(:<from>.*)Date:/m
    ];
    this.bodyRegexes = [];
    this.destinationRegexes = [];
    this.iphoneHtmlForwardRegexes = [
        /Sent from my iPhone.*Begin forwarded message:/g
    ];
    this.iphoneRawTextForwardRegexes = [
        /Sent from my iPhone/g,
        /Begin forwarded message:/g,
        /Sent using the free mail\.com iPhone App\s*Forwarded email/g
    ];

    EmailClientExtractorBase.call(this);
}

iPhoneClientExtractor.prototype.extractFromHTML = function (htmlstring)
{
    $ = cheerio.load(htmlstring);
    var quote_container = $('blockquote');

    if (quote_container.length == 0)
    {
        throw new errors.ExtractionError("Parsing of iPhone email forward failed. No blockquote tag was found.");
    }

    var sender, senderName, body, date, result;

    var sender = this.extractSender(quote_container.text());

    if (sender == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the sender email address.");
    }

    senderName = this.extractSenderName(quote_container.text());

    // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
    if (senderName === sender)
    {
        senderName = null;
    }

    date = this.extractDate(quote_container.text());

    if (date == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
    }

    body = this.extractBody($('body'), quote_container);

    if (body == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the body.");
    }

    result = {html: body, date: date, sender: sender, senderName: senderName};
    return result;
};

iPhoneClientExtractor.prototype.extractDate = function (headerText)
{
    var date_string = this.extractDateStringFromText(headerText);
    if (date_string == null)
    {
        // try the regex where the text is on one line
        var htmlOneString = headerText.replace(/\n/g, '');
        date_string = this.extractDateStringFromText(htmlOneString);
    }
    var date = this.extractDateFromTextSpecialCase(date_string);
    return date;
};

iPhoneClientExtractor.prototype.extractSender = function (headerText)
{
    var sender = this.extractSenderFromText(headerText);
    if (sender == null)
    {
        // try the regex where the text is on one line
        var htmlOneString = headerText.replace(/\n/g, '');
        sender = this.extractSenderFromText(htmlOneString);
    }
    return sender;
};

iPhoneClientExtractor.prototype.extractSenderName = function (headerText)
{
    var senderName = this.extractSenderNameFromText(headerText);
    if (senderName == null)
    {
        // try the regex where the text is on one line
        var htmlOneString = headerText.replace(/\n/g, '');
        senderName = this.extractSenderNameFromText(htmlOneString);
    }
    return senderName;
};

iPhoneClientExtractor.prototype.extractBody = function (bodyNode, quote_container)
{
    try
    {
        // try method 1
        return this.extractBody_method_1(bodyNode);
    }
    catch (err)
    {
        // try method 2
        return this.extractBody_method_2(quote_container);
    }
};

iPhoneClientExtractor.prototype.extractBody_method_2 = function (quote_container)
{
    // assume there is no body div
    // we assume the body is in the second 'blockquote' node
    var body = $(quote_container[1]).html();
    return body;
};

iPhoneClientExtractor.prototype.extractBody_method_1 = function (bodyNode)
{
    // the header is in the first blockquote
    // grab everything after the first blockquote
    var body_clone = bodyNode.clone();
    body_clone.empty();

    var indexBodyStart = 0;
    // find the first blockquote node
    var children = bodyNode[0].children;
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.type === "tag" && child.name === "blockquote")
        {
            // start body index
            indexBodyStart = i + 1;
            break;
        }
    }

    // copy the child elements that are part of the body
    var j = 0;
    for (var i = indexBodyStart; i < children.length; i++)
    {
        body_clone[0].children[j++] = children[i];
    }

    return body_clone.html();
};

iPhoneClientExtractor.prototype.extractFromRawText = function (emailBodyString)
{
    var sender, senderName, body, date, result;

    var sender = this.extractSender(emailBodyString);

    if (sender == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the sender email address.");
    }

    senderName = this.extractSenderName(emailBodyString);
    // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
    if (senderName === sender)
    {
        senderName = null;
    }

    date = this.extractDate(emailBodyString);

    if (date == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
    }

    body = this.extractBodyRawText(emailBodyString);

    if (body == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the body.");
    }

    result = {text: body, date: date, sender: sender, senderName: senderName};
    return result;

};

iPhoneClientExtractor.prototype.extractBodyRawText = function (emailBodyString)
{
    // copy everything after the "Subject" line
    var bodyText = "";
    var isFirstMimeHeaderFound = false;
    var isLastMimeHeaderFound = false;
    var lastMimeHeaderText = this.getLastMimeHeaderText(emailBodyString);
    // create an array from each line of text
    var textLines = emailBodyString.split("\n");
    for (var i = 0; i < textLines.length; i++)
    {
        var textLine = textLines[i];
        if (isFirstMimeHeaderFound && isLastMimeHeaderFound)
        {
            bodyText = bodyText + textLine + "\n";
        }
        else
        {
            var isMimeHeaderText = this.isMimeHeaderText(textLine);
            if (isMimeHeaderText)
            {
                if (!isFirstMimeHeaderFound) {isFirstMimeHeaderFound = true;}
                if (!isLastMimeHeaderFound)
                {
                    var index = textLine.indexOf(lastMimeHeaderText);
                    if (index > -1)
                    {
                        isLastMimeHeaderFound = true;
                    }
                }
            }
        }
    }

    // Strip out all of the "> " from the text
    bodyText = bodyText.replace(/(\n|^)(>[ \t]*)+[ \t]*/g, "\n").trim();

    return bodyText;
};

iPhoneClientExtractor.prototype.findForwardInHTML = function (htmlstring)
{
    // check if we have a unique string that only an iPhone mail client would have
    var htmlOneString = htmlstring.replace(/\n/g, '');

    var index_match = 0;
    for (var index_regex = 0; index_regex < this.iphoneHtmlForwardRegexes.length; index_regex++)
    {
        index_match = htmlOneString.regexIndexOf(this.iphoneHtmlForwardRegexes[index_regex]);
        if (index_match > -1)
        {
            break;
        }
    }
    return index_match;
};


iPhoneClientExtractor.prototype.findForwardInRawText = function (htmlstring)
{
    if (htmlstring === undefined || htmlstring === null) {
        return -1;
    }
    var htmlOneString = htmlstring.replace(/\n/g, '');

    var index_match = 0;
    for (var index_regex = 0; index_regex < this.iphoneRawTextForwardRegexes.length || index_match > -1; index_regex++)
    {
        index_match = htmlOneString.regexIndexOf(this.iphoneRawTextForwardRegexes[index_regex]);
        if (index_match > -1)
        {
            break;
        }
    }

    return index_match;
};

iPhoneClientExtractor.prototype.__proto__ = EmailClientExtractorBase.prototype;

module.exports = iPhoneClientExtractor;
