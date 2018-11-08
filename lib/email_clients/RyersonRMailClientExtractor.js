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
 * RyersonRMailClientExtractor.js
 *
 */

var EmailClientExtractorBase = require('./EmailClientExtractorBase');
var cheerio = require("cheerio");
var errors = require("../Errors");
var strptime = require('micro-strptime').strptime;
var render = require("cheerio/lib/render");
var namedRegex = require('named-regexp').named;

function RyersonRMailClientExtractor ()
{
    this.name = "ryersonRMail";
    this.dateFormats = [];
    this.dateRegexes = [];
    this.senderRegexes = [];
    this.bodyRegexes = [];
    this.destinationRegexes = [];

    EmailClientExtractorBase.call(this);
}

RyersonRMailClientExtractor.prototype.extractFromHTML = function (htmlstring)
{
    $ = cheerio.load(htmlstring);

    var sender, senderName,  body, date, result;

    sender = this.extractSender($.root()[0].children);

    if (sender == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the sender email address.");
    }

    senderName = this.extractSenderName();

    // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
    if (senderName === sender)
    {
        senderName = null;
    }

    date = this.extractDate($.root()[0].children);

    if (date == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
    }

    body = this.extractBody($.root()[0].children, $.root());

    if (body == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the body.");
    }

    result = {html: body, date: date, sender: sender, senderName: senderName};
    return result;
};

RyersonRMailClientExtractor.prototype.extractSender = function (children)
{
    var child = null;
    var fromFieldFound = false;
    // step 1: find the index for the "From:" field
    // step 2: find the first <a> tag after the "From:" field is found
    for (i = 0; i < children.length; i++) {
        child = children[i];
        if (!fromFieldFound && child.type === "text" && child.data.indexOf("From:") > -1) {
            fromFieldFound = true;
        }
        if (fromFieldFound && child.type === "tag" && child.name === "a")
        {
            // sender text
            return child.children[0].data.toString().trim();
        }
    }
    return null;
};

RyersonRMailClientExtractor.prototype.extractSenderName = function (children)
{
    // TODO: Currently this client is not being parsed, currently will not return a name. for now.
    var child = null;
    var fromFieldFound = false;
    // step 1: find the index for the "From:" field
    // step 2: extract data from that child
    for (i = 0; i < children.length; i++) {
        child = children[i];
        if (!fromFieldFound && child.type === "text" && child.data.indexOf("From:") > -1) {
            fromFieldFound = true;
        }
    }
    return null;
};

RyersonRMailClientExtractor.prototype.extractDate = function (children)
{
    var child = null;
    var dateRawText = null;
    var dateRawTextFound = false;
    // step 1: find the index for the "Date:" field
    // step 2: extract the date text
    for (i = 0; i < children.length; i++) {
        child = children[i];
        if (child.type === "text" && child.data.indexOf("Date:") > -1) {
            dateRawText = child.data.toString().trim();
            dateRawTextFound = true;
            break;
        }
    }

    if (dateRawTextFound)
    {
        // format is: Date:&nbsp;Fri, 13 Jun 2014 13:52:15 -0400
        var dateRegex = /^.*\s(\d+)\s(\w+)\s(\d+)\s(\d+):(\d+):(\d+)\s.*$/m;
        var dateMatch = namedRegex(dateRegex);
        var matches = dateMatch.exec(dateRawText);
        if (matches)
        {
            var dateString = matches[2] + " " + matches[1] + ", " + matches[3] + " " + matches[4] + ":" + matches[5] + ":" + matches[6];
            date = strptime(dateString, "%B %d, %Y %H:%M:%S");
            return date;
        }
    }

    return null;
};

RyersonRMailClientExtractor.prototype.extractBody = function (children, rootNode)
{
    var child = null;
    var fromFieldFound = false;
    // create an empty container for the body nodes
    //var temp_node_array = rootNode.find('br');
    var temp_node_array = rootNode.children().first();
    var body_clone = temp_node_array.clone();
    body_clone.empty();

    var indexBodyStart = 0;

    // step 1: find the "Subject:" field
    // step 2: the body is everything after the first <br> after the "Subject:" field
    for (var i = 0; i < children.length; i++) {
        child = children[i];
        if (!fromFieldFound && child.type === "text" && child.data.indexOf("Subject:") > -1) {
            fromFieldFound = true;
        }
        if (fromFieldFound && child.type === "tag" && child.name === "br")
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

RyersonRMailClientExtractor.prototype.findForwardInHTML = function (htmlstring)
{
    // step 1: remove line breaks
    var htmlOneString = htmlstring.replace(/\n/g, '');
    // step 2: check if we have a possible match for a ryersonRMail mail forward
    return htmlOneString.indexOf('---------- Forwarded message ----------');
};


RyersonRMailClientExtractor.prototype.findForwardInRawText = function (htmlstring)
{
    if (htmlstring === undefined || htmlstring === null) {
        return -1;
    }
    var htmlOneString = htmlstring.replace(/\n/g, '');
    return htmlOneString.indexOf(/---------- Forwarded message ----------/m)
};

RyersonRMailClientExtractor.prototype.__proto__ = EmailClientExtractorBase.prototype;

module.exports = RyersonRMailClientExtractor;
