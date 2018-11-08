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
 * YahooClientExtractor.js
 *
 */

var EmailClientExtractorBase = require('./EmailClientExtractorBase');
var cheerio = require("cheerio");
var errors = require("../Errors");
var strptime = require('micro-strptime').strptime;
var render = require("cheerio/lib/render");
var namedRegex = require('named-regexp').named;

function YahooClientExtractor ()
{
    this.name = "yahoo";
    this.dateFormats = ["%B %d, %Y %H:%M:%S %p",
        "%A, %B %d, %Y %H:%M %p",
        "%Y, %B, %d %H:%M %p",
        "%A, %d %B %Y %H:%M:%S %Z",
        "%B, %d, %Y at %H:%M:%S %p %Z",
        "%B %d, %Y at %H:%M:%S %Z",
        "%B %d, %Y at %H:%M:%S",
        "%A, %B %d, %Y at %H:%M %p",
        "%A, %B %d, %Y",
        "%d %B %Y %H:%M:%S %Z",
        "%d %B %Y %H:%M:%S",
        "%Y-%B-%d %H:%M:%S %Z",
        "%A %B %d %Y"];

    this.dateRegexes = [
        /\s*On\s*(:<date>.*((AM)|(PM))).*wrote.*$/m,
        /.*Sent:\s*\w*,\s*(:<date>.*)\sSubject.*$/m,
        // Sent: Sunday, November 4, 2012 1:57:51 PM
        /.*Sent:\s*\w*,\s*(:<date>.*)$/m,
        /Date:\s*(:<date>.*)Subject/m,
        /Date:\s*(:<date>.*)To:/m,
        /Date:\s*(:<date>[a-zA-Z]* [ at,:0-9]* ([A-Z]{3}))/m,
        /Date:\s*(:<date>[a-zA-Z]* [ at,:0-9]*)/m,
        /Date:\s*(:<date>[a-zA-Z0-9 :+,-]*)/m,
        /Date:\s*<\/\w+>(:<date>[a-zA-Z0-9 :+,-]*)/m,
        /Date:\s*(:<date>.*)$/m,
        /Sent:\s*[^a-zA-Z0-9:+,-](:<date>[a-zA-Z0-9 :+,-]*)\s*$/m,
        /Date:[\n\s]*(:<date>.*)Subject/m,
        /Date:[\n\s]*(:<date>.*)To:/m,
        /Date:[\n\s]*(:<date>[a-zA-Z]* [ at,:0-9]* ([A-Z]{3}))/m,
        /Date:[\n\s]*(:<date>[a-zA-Z]* [ at,:0-9]*)/m,
        /Date:[\n\s]*(:<date>[a-zA-Z0-9 :+,-]*)/m,
        /Date:[\n\s]*<\/\w+>(:<date>[a-zA-Z0-9 :+,-]*)/m,
        /Date:[\n\s]*(:<date>.*)$/m,
        /Sent:[\n\s]*[^a-zA-Z0-9:+,-](:<date>[a-zA-Z0-9 :+,-]*)\s*$/m,
        /Sent:[\n\s]*.*\s*$/m,
        /Date:[\n\s]*.*\s*$/m,
        /[a-zA-Z]{3}, \d{1,2} [a-zA-Z]{3} \d{2,4} \d{1,2}:\d{1,2}:\d{1,2} -\d{1,4}/
    ];
    this.senderRegexes = [
        /\s*On.*[(AM)|(PM)],(:<name>[^\<]*)<(:<from>.*)> wrote.*$/m,
        /.*From:(:<name>[^<]*)<(:<from>.*)>.*$/m,
        /^From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>To.*$/m,
        /^From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>Date.*$/m,
        /^From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.)+?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>Subject.*$/m,
        /^.*From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>Subject.*$/m,
        /^.*From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>[^a-zA-Z0-9-.]$/m,
        /From:\s*(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})To.*$/m,
        /From:\s*(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})Subject/m,
        /From:\s*<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>$/m,
        /From:[\s\w]*<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>/m,
        /^.*From:[^a-zA-Z0-9_.+-](:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})[^a-zA-Z0-9_.+-].*$/m
    ];
    this.bodyRegexes = [];
    this.destinationRegexes = [];

    EmailClientExtractorBase.call(this);
}

YahooClientExtractor.prototype.extractFromHTML = function (htmlstring)
{
    $ = cheerio.load(htmlstring);
    var quote_container = $('div.yahoo_quoted');

    if (quote_container.length == 0)
    {
        // if we don't find this div, try the alternate parse method
        return this.extractFromHTML_alternateMethod(htmlstring);
    }

    var sender, senderName, body, date, destination, result;

    var generalForwardString =  $(quote_container.find("div div div div div")[0]).text();

    sender = this.extractSenderFromText(generalForwardString);
    if (sender == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the sender email address.");
    }

    senderName = this.extractSenderNameFromText(generalForwardString);

    // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
    if (senderName === sender)
    {
        senderName = null;
    }

    date = this.extractDateFromText(generalForwardString);
    if (date == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
    }

    var bodyTags = quote_container.find('div.y_msg_container');
    body = $(bodyTags).html().trim();

    result = {html: body, date: date, sender: sender, senderName: senderName};
    return result;
};

YahooClientExtractor.prototype.extractFromHTML_alternateMethod = function (htmlstring)
{
    var $ = cheerio.load(htmlstring);

    var sender, senderName, body, date, destination, result;

    var headerDivText = $.root().find('div[dir="ltr"]').text();

    sender = this.extractSenderFromText(headerDivText);
    if (sender == null)
    {
        sender = this.extractSenderFromText($.root().text());
        if (sender == null)
        {
            throw new errors.ExtractionError("Parsing failed. Couldn't find the sender email address.");
        }
    }

    senderName = this.extractSenderNameFromText(headerDivText);
    if (senderName == null)
    {
        senderName = this.extractSenderNameFromText($.root().text());
    }

    // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
    if (senderName === sender)
    {
        senderName = null;
    }

    date = this.extractDateFromText(headerDivText);

    if (date == null)
    {
        date = this.extractDateFromText($.root().text());
        if (date == null)
        {
            throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
        }
    }

    // try to get the body using method 1
    body = this.findBodyMethod_1($.root());
    if (body === null)
    {
        // try to get the body using method 2
        body = this.findBodyMethod_2($.root(), htmlstring);
        if (body === null)
        {
            // try to get the body using method 3
            body = this.findBodyMethod_3($.root());
            if (body === null)
            {
                // try to get the body using method 4
                body = this.findBodyMethod_4($.root());
                if (body === null)
                {
                    throw new errors.ExtractionError("Parsing failed. Couldn't find the body.");
                }
            }
        }
    }

    result = {html: body, date: date, sender: sender, senderName: senderName};
    return result;
};

YahooClientExtractor.prototype.findBodyMethod_1 = function (root)
{
    return root.find('div.y_msg_container').html();
};

YahooClientExtractor.prototype.findBodyMethod_2 = function (root, htmlstring)
{
    // workaround for yahoo bug where they have a div that looks like this: <div class="yiv3417379316y_msg_container">
    var yahooContainerDivClassName = this.findYahooContainerDivClassName(htmlstring);
    if (yahooContainerDivClassName != null)
    {
        return root.find('div.' + yahooContainerDivClassName).html();
    }
    return null;
};

YahooClientExtractor.prototype.findBodyMethod_3 = function (root)
{
    // get the next sibling dom element after the mime header div
    var node = root.find('div[dir="ltr"]').next();
    if(node.length == 0)
    {
        return null;
    }
    while(node[0].name == 'br' || node[0].type == 'text')
    {
        node = node.next();
    }
    return node.html();
};

YahooClientExtractor.prototype.findBodyMethod_4 = function (root)
{
    // get all the nodes after the parent of the mime header div
    var parentNode = root.find('div[dir="ltr"]').parent();
    var parentSiblingNode = parentNode.next();
    return parentSiblingNode.html();
};

YahooClientExtractor.prototype.findYahooContainerDivClassName = function (htmlstring)
{
    var classNameRegex = /class="(:<cssclass>\w+y_msg_container)"/;
    var classMatch = namedRegex(classNameRegex);
    var matches = classMatch.exec(htmlstring);
    if (matches)
    {
        if (matches.captures.cssclass) {
            return matches.captures.cssclass.toString().trim();
        }
    }
    return null;
};


YahooClientExtractor.prototype.findForwardInHTML = function (htmlstring)
{
    var forward_index = htmlstring.indexOf("yahoo_quoted");
    if (forward_index != -1)
    {
        return forward_index;
    }
    forward_index = htmlstring.indexOf("----- Forwarded Message -----");
    if (forward_index != -1)
    {
        return forward_index;
    }
    // try to get the following pattern from the header text (if it exists)
    $ = cheerio.load(htmlstring);
    var headerDiv = $.root().find('div[dir="ltr"]');
    if (headerDiv != null)
    {
        return this.findForwardInHeaderText(htmlstring, headerDiv);
    }
    return -1;
};

YahooClientExtractor.prototype.findForwardInHeaderText = function (htmlstring, headerDiv)
{
    var headerTextOneString = headerDiv.text().replace(/\n/g, '');
    // On Saturday,
    var nameRegex = /(:<forwardString>On\s\w*),.*<.*> wrote:/g;
    var nameMatch = namedRegex(nameRegex);
    var matches = nameMatch.exec(headerTextOneString);
    if (matches)
    {
        var forwardString = null;
        if (matches.captures.forwardString) {
            forwardString = matches.captures.forwardString.toString().trim();
            // get index of forwardString in the htmlstring
            var index = htmlstring.replace(/\n/g, '').indexOf(forwardString);
            return index;
        }
    }
    return -1;
};


YahooClientExtractor.prototype.findForwardInRawText = function (htmlstring)
{
    if (htmlstring === undefined || htmlstring === null) {
        return -1;
    }
    return htmlstring.indexOf(/On.*<.*> wrote:$/m)
};

YahooClientExtractor.prototype.__proto__ = EmailClientExtractorBase.prototype;

module.exports = YahooClientExtractor;
