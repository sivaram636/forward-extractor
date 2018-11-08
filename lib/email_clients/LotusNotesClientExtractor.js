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
 * LotusNotesClientExtractor.js
 *
 */

var EmailClientExtractorBase = require('./EmailClientExtractorBase');
var cheerio = require("cheerio");
var errors = require("../Errors");
var strptime = require('micro-strptime').strptime;
var render = require("cheerio/lib/render");
var namedRegex = require('named-regexp').named;

function LotusNotesClientExtractor ()
{
    this.name = "lotusnotes";
    this.dateFormats = ["%Y/%m/%d %H:%M %p"];
    this.dateRegexes = [
        /----- Forwarded by .*\n.* on (:<date>[^-]*) -----/m
        //Date: June 3, 2014 at 3:37:42 PM EDT
    ];
    this.senderRegexes = [
        /----- Forwarded by [^-]*\-*(:<name>[^<]*)<(:<from>[^>]*)>/m
    ];
    this.bodyRegexes = [];
    this.destinationRegexes = [];

    EmailClientExtractorBase.call(this);
}

LotusNotesClientExtractor.prototype.extractFromHTML = function (htmlstring)
{
    var $ = cheerio.load(htmlstring);

    var text = $.root().text();

    var sender, senderName, body, date, result;

    sender = this.extractSenderFromText(text);

    if (sender == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the sender email address.");
    }

    // remove new lines from text to allow for easier parsing
    var newText = text.replace(/\n/g, ' ');
    senderName = this.extractSenderNameFromText(newText);

    // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
    if (senderName === sender)
    {
        senderName = null;
    }

    date = this.extractDateFromText(text);

    if (date == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
    }

    body = this.extractBody($);

    if (body == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the body.");
    }

    result = {html: body, date: date, sender: sender, senderName: senderName};
    return result;
};



LotusNotesClientExtractor.prototype.extractBody = function ($)
{
    var bodyElements = $.root().find('table').nextAll();
    return render(bodyElements);
};


LotusNotesClientExtractor.prototype.findForwardInHTML = function (htmlstring)
{
    // check if we have a unique string that only an apple mail client would have
    return htmlstring.regexIndexOf(/----- Forwarded by/g);
};


LotusNotesClientExtractor.prototype.findForwardInRawText = function (htmlstring)
{
    if (htmlstring === undefined || htmlstring === null) {
        return -1;
    }
    return htmlstring.indexOf(/----- Forwarded by/m)
};

LotusNotesClientExtractor.prototype.__proto__ = EmailClientExtractorBase.prototype;

module.exports = LotusNotesClientExtractor
